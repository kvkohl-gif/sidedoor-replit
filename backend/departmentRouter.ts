import OpenAI from "openai";
import { ROLE_TAXONOMY_CONTEXT } from "./systemPromptTaxonomy";
import { classifyJobRole } from "./roleTaxonomyService";

let _openai: OpenAI | null = null;
function getOpenAI() { if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy" }); return _openai; }
const openai = new Proxy({} as OpenAI, { get(_, p) { return (getOpenAI() as any)[p]; } });

export type DeptId = 'product' | 'engineering' | 'design' | 'data' | 'it' | 'marketing' | 'sales' | 'customer_success' | 'operations' | 'people' | 'finance' | 'legal';

export interface DepartmentInference {
  departments: { id: DeptId; label: string; confidence: number }[];
  primary_titles: { title: string; confidence: number }[];
  cross_function_titles: { title: string; confidence: number }[];
  summary: string;
}

export const APOLLO_DEPT_MAP: Record<DeptId, string[]> = {
  product: ['product', 'product management'],
  engineering: ['engineering', 'software engineering', 'technology'],
  design: ['design', 'ux', 'user experience'],
  data: ['data', 'analytics', 'data science', 'business intelligence'],
  it: ['it', 'information technology', 'security'],
  marketing: ['marketing', 'growth'],
  sales: ['sales', 'revenue'],
  customer_success: ['customer success', 'support', 'customer experience'],
  operations: ['operations', 'business operations'],
  people: ['people', 'human resources', 'talent', 'recruiting'],
  finance: ['finance'],
  legal: ['legal']
};

// Titles to avoid when searching for non-CS roles
const TITLE_STOPWORDS = [
  'sales development', 'account executive', 'customer success manager',
  'support specialist', 'marketing coordinator'
];

function sanitizeTitles(titles: string[]): string[] {
  return titles
    .map(t => t.trim())
    .filter(t => !TITLE_STOPWORDS.some(stop => t.toLowerCase().includes(stop)));
}

/**
 * Infer the primary department and target titles from a job description
 */
export async function inferDepartmentTargets(
  company_name: string,
  job_title: string,
  job_description: string
): Promise<DepartmentInference> {
  // Fast taxonomy pre-classification
  const classification = classifyJobRole(job_title, job_description);
  const taxonomyHint = classification.taxonomyMatch
    ? `\n\nTAXONOMY PRE-CLASSIFICATION (use as strong prior, override only if job description clearly contradicts):\n${classification.taxonomyContext}`
    : '';

  const systemPrompt = `You are a Department Router for recruiter contact discovery.

INPUT:
- company_name (string)
- job_title (string)
- job_description (string)

${ROLE_TAXONOMY_CONTEXT}
${taxonomyHint}

TASKS:
1) Infer the MOST LIKELY department(s) that own this role inside the company org chart.
   Use this canonical taxonomy (id → label):
   - product            → Product Management
   - engineering        → Engineering / Software
   - design             → Design / UX
   - data               → Data / Analytics / Science
   - it                 → IT / InfoSec
   - marketing          → Marketing / Growth
   - sales              → Sales
   - customer_success   → Customer Success / Support
   - operations         → Operations / BizOps
   - people             → People / HR / Recruiting
   - finance            → Finance
   - legal              → Legal

2) Produce a DEPARTMENT-ALIGNED title target list for leadership/decision-maker contacts
   who would be relevant to the role. Mix IC/manager/leader titles but keep within the chosen
   department(s). Prefer modern, real-world titles used at tech companies.

3) Also produce a small secondary list of CROSS-FUNCTION titles that commonly collaborate
   with this role (e.g., Product ↔ Design/Eng, CS ↔ Sales/Support). Keep to 3–6 titles total.

4) Return confidence scores (0–100) for each department and title.

STRICT JSON OUTPUT:
{
  "departments": [
    {"id":"product","label":"Product Management","confidence":95}
  ],
  "primary_titles": [
    {"title":"Director of Product Management","confidence":90},
    {"title":"Senior Product Manager","confidence":88},
    {"title":"VP of Product","confidence":85}
  ],
  "cross_function_titles": [
    {"title":"Director of Design","confidence":70},
    {"title":"Director of Engineering","confidence":70}
  ],
  "summary": "One sentence why these picks fit."
}

RULES:
- DO NOT include departments or titles that don't match the role's function unless placed in cross_function_titles.
- If job is clearly Customer Success, set departments to customer_success and make CS titles primary.
- If ambiguous, return up to 2 departments with scores, but keep primary_titles aligned with the TOP department.
- Always produce valid JSON. No prose outside JSON.`;

  const userPrompt = `Analyze this job posting and infer departments and titles:

Company: ${company_name}
Job Title: ${job_title}
Job Description: ${job_description}

Return department inference in the specified JSON format.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    console.log(`Department inference for ${job_title}:`, JSON.stringify(result, null, 2));
    
    return {
      departments: Array.isArray(result.departments) ? result.departments : [
        { id: "product", label: "Product Management", confidence: 85 }
      ],
      primary_titles: Array.isArray(result.primary_titles) ? result.primary_titles : [
        { title: "Product Manager", confidence: 90 },
        { title: "Director of Product", confidence: 85 }
      ],
      cross_function_titles: Array.isArray(result.cross_function_titles) ? result.cross_function_titles : [
        { title: "Engineering Manager", confidence: 70 }
      ],
      summary: result.summary || "Department targeting based on job function analysis."
    };
  } catch (error) {
    console.error("Department inference error:", error);
    // Fallback for Product Management roles
    return {
      departments: [{ id: "product", label: "Product Management", confidence: 85 }],
      primary_titles: [
        { title: "Product Manager", confidence: 90 },
        { title: "Senior Product Manager", confidence: 85 },
        { title: "Director of Product", confidence: 80 }
      ],
      cross_function_titles: [
        { title: "Engineering Manager", confidence: 70 },
        { title: "Design Manager", confidence: 65 }
      ],
      summary: "Fallback department targeting for product roles."
    };
  }
}

export interface ApolloSearchPlan {
  label: string;
  payload: {
    organization_ids?: string[];
    person_titles?: string[];
    person_seniorities?: string[];
    person_departments?: string[];
    per_page: number;
    reveal_personal_emails?: boolean;
  };
  hardLimit: number;
}

/**
 * Build a prioritized search plan based on department inference
 */
export function buildApolloPlans(orgId: string, inference: DepartmentInference): ApolloSearchPlan[] {
  const topDept = inference.departments.sort((a, b) => b.confidence - a.confidence)[0];
  const deptFilters = topDept ? APOLLO_DEPT_MAP[topDept.id] : [];

  const primaryTitles = sanitizeTitles(
    inference.primary_titles
      .sort((a, b) => b.confidence - a.confidence)
      .map(x => x.title)
  );

  const crossTitles = sanitizeTitles(
    inference.cross_function_titles
      .sort((a, b) => b.confidence - a.confidence)
      .map(x => x.title)
  );

  // Focus on senior decision-makers only - remove manager and principal
  const SENIORITIES = ['director', 'vp', 'c_suite', 'head', 'lead'];

  const plans: ApolloSearchPlan[] = [
    // 1) Primary dept + primary titles (reduced to 3 contacts)
    {
      label: 'primary-dept+titles',
      payload: {
        organization_ids: [orgId],
        person_titles: primaryTitles,
        person_seniorities: SENIORITIES,
        person_departments: deptFilters,
        per_page: 3,
        reveal_personal_emails: true
      },
      hardLimit: 3
    },
    // 2) Primary dept + seniorities (reduced to 3 contacts)
    {
      label: 'primary-dept+seniorities',
      payload: {
        organization_ids: [orgId],
        person_seniorities: SENIORITIES,
        person_departments: deptFilters,
        per_page: 3,
        reveal_personal_emails: true
      },
      hardLimit: 3
    }
  ];

  // 3) Cross-function titles (reduced to 2 contacts, only if needed)
  if (crossTitles.length) {
    plans.push({
      label: 'cross-function+titles',
      payload: {
        organization_ids: [orgId],
        person_titles: crossTitles,
        person_seniorities: SENIORITIES,
        per_page: 2,
        reveal_personal_emails: true
      },
      hardLimit: 2
    });
  }

  // 4) Talent/Recruiting (reduced to 2 contacts as fallback)
  plans.push({
    label: 'recruiting-fallback',
    payload: {
      organization_ids: [orgId],
      person_titles: ['Recruiter', 'Senior Recruiter', 'Talent Acquisition', 'Head of Talent', 'Director of Talent'],
      person_seniorities: SENIORITIES,
      person_departments: APOLLO_DEPT_MAP.people,
      per_page: 2,
      reveal_personal_emails: true
    },
    hardLimit: 2
  });

  return plans;
}

/**
 * Check if a contact is aligned with the target department
 */
export function isContactDeptAligned(
  contactTitle: string,
  contactDepartment: string | undefined,
  topDept: DeptId,
  crossTitles: string[]
): boolean {
  const title = contactTitle.toLowerCase();

  // If title matches any cross-function title, allow
  if (crossTitles.some(ct => title.includes(ct.toLowerCase()))) {
    return true;
  }

  // Check department alignment if available
  if (contactDepartment) {
    const dept = contactDepartment.toLowerCase();
    const allowed = APOLLO_DEPT_MAP[topDept].some(d => dept.includes(d));
    if (allowed) return true;
  }

  // Fall back to title heuristics
  return titleHeuristicMatchesTopDept(title, topDept);
}

function titleHeuristicMatchesTopDept(title: string, dept: DeptId): boolean {
  const t = title.toLowerCase();
  
  if (dept === 'product') {
    return /(product\s(manager|lead|director|vp|head|owner)|pm\b)/.test(t);
  }
  if (dept === 'customer_success') {
    return /(customer\s(success|experience)|support)/.test(t);
  }
  if (dept === 'engineering') {
    return /(engineer|engineering|cto|vp engineering)/.test(t);
  }
  if (dept === 'design') {
    return /(design|ux|ui|product design)/.test(t);
  }
  if (dept === 'data') {
    return /(data|analytics|scientist|analyst)/.test(t);
  }
  if (dept === 'marketing') {
    return /(marketing|growth|demand|brand)/.test(t);
  }
  if (dept === 'sales') {
    return /(sales|revenue|account|business development)/.test(t);
  }
  
  // Don't over-reject if uncertain
  return true;
}