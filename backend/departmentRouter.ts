import { callClaude } from "./claude";
import { ROLE_TAXONOMY_CONTEXT } from "./systemPromptTaxonomy";
import { classifyJobRole } from "./roleTaxonomyService";

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
   Use this canonical taxonomy (id -> label):
   - product            -> Product Management
   - engineering        -> Engineering / Software
   - design             -> Design / UX
   - data               -> Data / Analytics / Science
   - it                 -> IT / InfoSec
   - marketing          -> Marketing / Growth
   - sales              -> Sales
   - customer_success   -> Customer Success / Support
   - operations         -> Operations / BizOps
   - people             -> People / HR / Recruiting
   - finance            -> Finance
   - legal              -> Legal

2) Produce a DEPARTMENT-ALIGNED title target list for leadership/decision-maker contacts
   who would be relevant to the role. Mix IC/manager/leader titles but keep within the chosen
   department(s). Prefer modern, real-world titles used at tech companies.

3) Also produce a small secondary list of CROSS-FUNCTION titles that commonly collaborate
   with this role (e.g., Product <-> Design/Eng, CS <-> Sales/Support). Keep to 3-6 titles total.

4) Return confidence scores (0-100) for each department and title.

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
    const raw = await callClaude({
      system: systemPrompt,
      user: userPrompt,
      jsonMode: true,
      temperature: 0.1,
    });

    const result = JSON.parse(raw);

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
export function buildApolloPlans(orgId: string, inference: DepartmentInference, employeeCount?: number): ApolloSearchPlan[] {
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

  // Tiered seniority levels for waterfall search
  const TIER_1 = ['director', 'vp', 'c_suite', 'head'];        // Skip-level / senior decision-makers
  const TIER_2 = ['manager', 'lead'];                            // Direct hiring managers
  const TIER_3 = ['senior'];                                     // Senior ICs / team leads (advocates)

  // Adapt strategy to company size
  const isSmall = (employeeCount || 0) <= 200;
  const isEnterprise = (employeeCount || 0) > 2000;

  const plans: ApolloSearchPlan[] = [];

  // ── HIRING MANAGER BUCKET ──────────────────────────────────

  // Tier 1: Director/VP/Head in the department (skip-level decision-makers)
  // For small companies, combine Tier 1+2 since fewer people exist
  plans.push({
    label: 'hm-tier1-dept-leadership',
    payload: {
      organization_ids: [orgId],
      person_titles: primaryTitles,
      person_seniorities: isSmall ? [...TIER_1, ...TIER_2] : TIER_1,
      ...(deptFilters.length > 0 && !isSmall ? { person_departments: deptFilters } : {}),
      per_page: 5,
      reveal_personal_emails: true
    },
    hardLimit: isSmall ? 5 : 3
  });

  // Tier 2: Manager-level in department (direct hiring managers — the person you'd report to)
  if (!isSmall) {
    plans.push({
      label: 'hm-tier2-dept-managers',
      payload: {
        organization_ids: [orgId],
        person_titles: primaryTitles,
        person_seniorities: TIER_2,
        ...(deptFilters.length > 0 ? { person_departments: deptFilters } : {}),
        per_page: 5,
        reveal_personal_emails: true
      },
      hardLimit: 3
    });
  }

  // Tier 3: Senior ICs with relevant titles (internal advocates, especially for tech roles)
  plans.push({
    label: 'hm-tier3-senior-ics',
    payload: {
      organization_ids: [orgId],
      person_titles: primaryTitles,
      person_seniorities: TIER_3,
      per_page: 3,
      reveal_personal_emails: true
    },
    hardLimit: 2
  });

  // Safety net: Title match WITHOUT department filter (Apollo dept tags are often wrong/missing)
  plans.push({
    label: 'hm-safety-titles-no-dept',
    payload: {
      organization_ids: [orgId],
      person_titles: primaryTitles,
      person_seniorities: [...TIER_1, ...TIER_2],
      per_page: 5,
      reveal_personal_emails: true
    },
    hardLimit: 3
  });

  // Cross-functional contacts (e.g. Engineering Manager for a PM role)
  if (crossTitles.length) {
    plans.push({
      label: 'hm-cross-function',
      payload: {
        organization_ids: [orgId],
        person_titles: crossTitles,
        person_seniorities: [...TIER_1, ...TIER_2],
        per_page: 3,
        reveal_personal_emails: true
      },
      hardLimit: 2
    });
  }

  // ── RECRUITER/GATEKEEPER BUCKET ────────────────────────────

  // For small companies, recruiters might have generalist titles
  const recruiterTitles = isSmall
    ? ['Recruiter', 'Talent Acquisition', 'HR Manager', 'Head of People',
       'People Operations', 'Chief of Staff', 'Office Manager']
    : isEnterprise
    ? ['Technical Recruiter', 'Senior Technical Recruiter', 'Talent Acquisition Partner',
       'Talent Acquisition Manager', 'Recruiting Manager', 'Lead Recruiter', 'Senior Recruiter']
    : ['Recruiter', 'Senior Recruiter', 'Technical Recruiter', 'Talent Acquisition',
       'Talent Acquisition Manager', 'Head of Talent', 'HR Manager', 'People Operations'];

  plans.push({
    label: 'recruiter-primary',
    payload: {
      organization_ids: [orgId],
      person_titles: recruiterTitles,
      per_page: 5,
      reveal_personal_emails: true
    },
    hardLimit: 3
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

  if (crossTitles.some(ct => title.includes(ct.toLowerCase()))) {
    return true;
  }

  if (contactDepartment) {
    const dept = contactDepartment.toLowerCase();
    const allowed = APOLLO_DEPT_MAP[topDept].some(d => dept.includes(d));
    if (allowed) return true;
  }

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

  return true;
}
