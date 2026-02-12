import OpenAI from "openai";
import { ROLE_TAXONOMY_CONTEXT } from "./systemPromptTaxonomy";
import { classifyJobRole } from "./roleTaxonomyService";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

export interface JobDataExtraction {
  job_title: string;
  company_name: string;
  job_url: string;
  company_website: string;
  location: string;
  job_description: string;
  key_responsibilities: string[];
  requirements: string[];
  likely_departments: string[];
}

export interface RecruitingInsights {
  linkedin_keywords: string[];
  likely_departments: string[];
}

export interface RecruiterExtraction {
  company_name: string;
  job_title: string;
  recruiters: {
    name: string;
    title: string;
    email: string;
    linkedin_url: string;
    confidence_score: number;
  }[];
  email_draft: string;
  linkedin_message: string;
}

export interface RecruiterNameExtraction {
  recruiter_name: string | null;
  title: string | null;
  source_type: "job_description" | "job_url";
  company_name: string | null;
  contact_info?: {
    email?: string;
    phone?: string;
    linkedin?: string;
  };
}

// Department mapping for two-bucket outreach system
export interface DepartmentTarget {
  department: string;
  titles: string[];
  seniorities: string[];
}

export interface TwoBucketTargets {
  recruiter_contacts: {
    titles: string[];
    priority: boolean;
  };
  department_lead_contacts: {
    primary_department: string;
    titles: string[];
    seniorities: string[];
    job_title_match: string;
  };
}

/**
 * Deterministic department mapping based on job title
 */
export function mapJobTitleToDepartment(jobTitle: string): DepartmentTarget | null {
  const titleLower = jobTitle.toLowerCase();
  
  // Department mapping logic as specified in requirements
  const departmentMappings: Record<string, DepartmentTarget> = {
    "product": {
      department: "Product Management",
      titles: ["Head of Product", "VP of Product", "Director of Product", "Chief Product Officer", "Product Lead"],
      seniorities: ["director", "vp", "head", "c_suite"]
    },
    "engineering": {
      department: "Engineering",
      titles: ["Head of Engineering", "VP of Engineering", "Director of Engineering", "CTO", "Engineering Manager", "Staff Engineer"],
      seniorities: ["manager", "director", "vp", "head", "c_suite"]
    },
    "design": {
      department: "Design", 
      titles: ["Head of Design", "VP of Design", "Director of Design", "Chief Design Officer", "Design Lead"],
      seniorities: ["director", "vp", "head", "c_suite"]
    },
    "marketing": {
      department: "Marketing",
      titles: ["Head of Marketing", "VP of Marketing", "Director of Marketing", "CMO", "Marketing Manager"],
      seniorities: ["manager", "director", "vp", "head", "c_suite"]
    },
    "sales": {
      department: "Sales",
      titles: ["Head of Sales", "VP of Sales", "Director of Sales", "Chief Revenue Officer", "Sales Manager"],
      seniorities: ["manager", "director", "vp", "head", "c_suite"]
    },
    "data": {
      department: "Data",
      titles: ["Head of Data", "VP of Data", "Director of Data Science", "Chief Data Officer", "Data Science Manager"],
      seniorities: ["manager", "director", "vp", "head", "c_suite"]
    },
    "operations": {
      department: "Operations",
      titles: ["Head of Operations", "VP of Operations", "Director of Operations", "COO", "Operations Manager"],
      seniorities: ["manager", "director", "vp", "head", "c_suite"]
    },
    "customer": {
      department: "Customer Experience",
      titles: ["Head of Customer Success", "VP of Customer Experience", "Director of Customer Support", "Customer Success Manager"],
      seniorities: ["manager", "director", "vp", "head", "c_suite"]
    },
    "people": {
      department: "Human Resources",
      titles: ["Head of People", "VP of Human Resources", "Director of HR", "CHRO", "People Operations Manager"],
      seniorities: ["manager", "director", "vp", "head", "c_suite"]
    },
    "finance": {
      department: "Finance",
      titles: ["Head of Finance", "VP of Finance", "Director of Finance", "CFO", "Finance Manager"],
      seniorities: ["manager", "director", "vp", "head", "c_suite"]
    }
  };

  // Check for exact matches
  for (const [keyword, department] of Object.entries(departmentMappings)) {
    if (titleLower.includes(keyword)) {
      return department;
    }
  }

  // Additional specific mappings
  if (titleLower.includes("software engineer") || titleLower.includes("developer") || titleLower.includes("tech")) {
    return departmentMappings["engineering"];
  }
  
  if (titleLower.includes("ux") || titleLower.includes("ui")) {
    return departmentMappings["design"];
  }
  
  if (titleLower.includes("ml") || titleLower.includes("machine learning") || titleLower.includes("data scientist")) {
    return departmentMappings["data"];
  }
  
  if (titleLower.includes("account executive") || titleLower.includes("business development")) {
    return departmentMappings["sales"];
  }
  
  if (titleLower.includes("customer support") || titleLower.includes("cx")) {
    return departmentMappings["customer"];
  }
  
  if (titleLower.includes("chief of staff")) {
    return departmentMappings["operations"];
  }
  
  if (titleLower.includes("hr") || titleLower.includes("people")) {
    return departmentMappings["people"];
  }
  
  if (titleLower.includes("controller")) {
    return departmentMappings["finance"];
  }

  return null; // No clear department match
}

/**
 * Extract recruiter name explicitly mentioned in job description
 */
export async function extractRecruiterName(content: string): Promise<RecruiterNameExtraction> {
  const systemPrompt = `You extract explicitly listed recruiter/hiring contact names from job pages.

Return ONLY valid JSON (no prose). Extract names ONLY when the page clearly identifies a person as a recruiter, sourcer, hiring manager, or application contact. Do NOT infer from general staff pages or LinkedIn buttons.

Scan patterns:
- "Contact [Name]", "Apply to [Name]", "Recruiter: [Name]", "Hiring Manager: [Name]", "Questions? Reach out to [Name]"
- mailto: links and nearby text
- Signature blocks near application instructions ("Best regards, [Name], [Title]")
- Labeled ATS contact sections

If multiple, include all. If none, return an empty array.

OUTPUT JSON SHAPE:
{
  "recruiter_contacts": [
    {
      "name": "string",
      "role": "Recruiter|Hiring Manager|Talent Acquisition|Sourcer|Other",
      "email": "string|Not specified",
      "source_snippet": "short quote around the match"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const extraction = JSON.parse(response.choices[0].message.content || "{}");
    
    // Convert new format to old format for compatibility
    const contacts = Array.isArray(extraction.recruiter_contacts) ? extraction.recruiter_contacts : [];
    const firstContact = contacts[0];
    
    return {
      recruiter_name: firstContact?.name || null,
      title: firstContact?.role || null,
      source_type: "job_description",
      company_name: null
    } as RecruiterNameExtraction;
  } catch (error) {
    console.error("Error extracting recruiter name:", error);
    return {
      recruiter_name: null,
      title: null,
      source_type: "job_description",
      company_name: null
    };
  }
}

/**
 * Extract Apollo search parameters from job content using enhanced structure
 */
export async function extractApolloSearchParams(content: string): Promise<{
  job_title: string | undefined;
  company_name: string | undefined;
  domain: string | undefined;
  location: string | undefined;
  job_country?: string;
  job_region?: string;
  company_hq_country?: string;
  remote_hiring_countries?: string[];
  is_remote_job?: boolean;
  organization_locations: string[];
  primary_department: string;
  recruiter_departments: string[];
  department_lead_departments: string[];
  recruiter_title_targets: Array<{ title: string; confidence: number }>;
  department_lead_title_targets: Array<{ title: string; confidence: number }>;
  person_seniorities: string[];
  include_similar_titles: boolean;
  fallback_recruiter_titles: string[];
  fallback_departments: string[];
}> {
  // Pre-classify with taxonomy for context injection
  const taxonomyClassification = classifyJobRole(
    content.substring(0, 200) // Use first 200 chars which typically contain the job title
  );
  const taxonomyHint = taxonomyClassification.taxonomyMatch
    ? `\n\nTAXONOMY PRE-CLASSIFICATION (use as strong prior):\n${taxonomyClassification.taxonomyContext}`
    : '';

  const systemPrompt = `You prepare high-precision Apollo People Search parameters from a job description.

${ROLE_TAXONOMY_CONTEXT}
${taxonomyHint}

Return ONLY valid JSON (no prose). Do not hallucinate. Use exact strings when present; otherwise omit or leave [].

Rules:
- Provide BOTH the exact scraped job title and a normalized base title (remove seniority, contract labels, parentheticals; map common synonyms, e.g., "Software Engineer" ⇄ "Software Developer").
- Keep include_similar_titles=false for primary search; also return a fallback block that can loosen matches using the normalized title.
- Classify departments (primary + optional secondary) from: Engineering, Product Management, Design, Data Analysis, Marketing, Sales, Customer Success, Leadership, Operations, Compliance, Other.
- Titles to target:
  - Recruiter bucket: "Recruiter", "Technical Recruiter", "Talent Acquisition", "Sourcer", "Senior Technical Recruiter", "Recruiting Manager/Lead/Director", etc.
  - Department lead bucket: SPECIFIC role-relevant leadership for the job's primary department:
    * Product Management jobs: "Product Manager", "Senior Product Manager", "Principal Product Manager", "Director of Product", "VP Product", "Head of Product"
    * Engineering jobs: "Engineering Manager", "Senior Engineering Manager", "Director of Engineering", "VP Engineering", "Head of Engineering", "CTO"
    * Design jobs: "Design Manager", "Senior Design Manager", "Director of Design", "VP Design", "Head of Design"
    * Data/Analytics jobs: "Data Manager", "Analytics Manager", "Director of Data", "Head of Analytics"
  - EXCLUDE: Customer Success, Sales, Marketing, Operations roles unless explicitly relevant to the job posting
- Rank every target title with confidence 0–100 based on job context and department relevance.
- Geography: extract city/region/country if present; infer cautiously from page/company if explicitly indicated (otherwise leave empty).
- Seniority: "Intern/Entry", "Associate", "Mid", "Senior", "Lead/Staff/Principal", "Manager", "Director", "VP", "C‑level", or "Not specified".

OUTPUT JSON SHAPE:
{
  "exact_title": "string",
  "normalized_title": "string",
  "primary_department": "Engineering|Product Management|Design|Data Analysis|Marketing|Sales|Customer Success|Leadership|Operations|Compliance|Other",
  "secondary_departments": ["..."],
  "geography": {
    "cities": ["..."],
    "regions": ["..."],
    "countries": ["..."],
    "remote_ok": true|false|null
  },
  "seniority": "Intern/Entry|Associate|Mid|Senior|Lead/Staff/Principal|Manager|Director|VP|C-level|Not specified",
  "keywords": ["role terms","stack/tools","domain"],
  "recruiter_titles": [
    {"title":"Technical Recruiter","confidence":95},
    {"title":"Senior Recruiter","confidence":88},
    {"title":"Talent Acquisition Partner","confidence":85}
  ],
  "department_lead_titles": [
    {"title":"Engineering Manager","confidence":92},
    {"title":"Director of Engineering","confidence":85}
  ],
  "include_similar_titles": false,
  "fallback": {
    "use_normalized_title": true,
    "fallback_recruiter_titles": [
      {"title":"Recruiter","confidence":75},
      {"title":"Talent Sourcer","confidence":70}
    ],
    "fallback_departments": ["Engineering","Product Management","Design","Data Analysis"]
  },
  "debug_notes": ["why a department was chosen", "signals used for geography"]
}`;

  const userPrompt = `Extract Apollo search parameters from this job posting content:

${content}

Return the extracted data in the JSON format specified.`;

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
    
    return {
      job_title: result.job_title || undefined,
      company_name: result.company_name || undefined,
      domain: result.domain || undefined,
      location: result.location || undefined,
      job_country: result.job_country || undefined,
      job_region: result.job_region || undefined,
      company_hq_country: result.company_hq_country || undefined,
      remote_hiring_countries: Array.isArray(result.remote_hiring_countries) ? result.remote_hiring_countries : [],
      is_remote_job: Boolean(result.is_remote_job),
      organization_locations: Array.isArray(result.organization_locations) ? result.organization_locations : [],
      primary_department: result.primary_department || "Other",
      recruiter_departments: Array.isArray(result.recruiter_departments) ? result.recruiter_departments : ["People", "Human Resources", "Recruiting", "Talent"],
      department_lead_departments: Array.isArray(result.department_lead_departments) ? result.department_lead_departments : [result.primary_department || "Other"],
      recruiter_title_targets: Array.isArray(result.recruiter_title_targets) ? result.recruiter_title_targets : [
        { title: "Technical Recruiter", confidence: 95 },
        { title: "Talent Acquisition Manager", confidence: 90 },
        { title: "People Operations Manager", confidence: 85 },
        { title: "People Operations", confidence: 85 },
        { title: "HR Business Partner", confidence: 80 },
        { title: "Talent Partner", confidence: 80 }
      ],
      department_lead_title_targets: Array.isArray(result.department_lead_title_targets) ? result.department_lead_title_targets : [
        // Smart defaults based on primary department
        ...(result.primary_department === "Product Management" ? [
          { title: "Product Manager", confidence: 95 },
          { title: "Senior Product Manager", confidence: 90 },
          { title: "Principal Product Manager", confidence: 85 },
          { title: "Director of Product", confidence: 80 },
          { title: "VP Product", confidence: 75 }
        ] : result.primary_department === "Engineering" ? [
          { title: "Engineering Manager", confidence: 95 },
          { title: "Senior Engineering Manager", confidence: 90 },
          { title: "Director of Engineering", confidence: 85 },
          { title: "VP Engineering", confidence: 80 },
          { title: "Head of Engineering", confidence: 75 }
        ] : [
          { title: "Manager", confidence: 90 },
          { title: "Director", confidence: 85 },
          { title: "Senior Manager", confidence: 80 }
        ])
      ],
      person_seniorities: Array.isArray(result.person_seniorities) ? result.person_seniorities : ["manager", "head", "director", "vp", "c_suite"],
      include_similar_titles: Boolean(result.include_similar_titles === undefined ? false : result.include_similar_titles),
      fallback_recruiter_titles: Array.isArray(result.fallback_recruiter_titles) ? result.fallback_recruiter_titles : ["Recruiter", "HR Manager", "People Operations", "Talent Sourcer"],
      fallback_departments: Array.isArray(result.fallback_departments) ? result.fallback_departments : ["People", "Recruiting", "Talent"]
    };
  } catch (error) {
    console.error("OpenAI Apollo params extraction error:", error);
    return {
      job_title: undefined,
      company_name: undefined,
      domain: undefined,
      location: undefined,
      job_country: undefined,
      job_region: undefined,
      company_hq_country: undefined,
      remote_hiring_countries: [],
      is_remote_job: false,
      organization_locations: [],
      primary_department: "Other",
      recruiter_departments: ["People", "Human Resources", "Recruiting", "Talent"],
      department_lead_departments: ["Other"],
      recruiter_title_targets: [
        { title: "Technical Recruiter", confidence: 95 },
        { title: "Talent Acquisition Manager", confidence: 90 },
        { title: "People Operations Manager", confidence: 85 }
      ],
      department_lead_title_targets: [
        { title: "Director", confidence: 90 },
        { title: "Manager", confidence: 85 }
      ],
      person_seniorities: ["manager", "head", "director", "vp", "c_suite"],
      include_similar_titles: false,
      fallback_recruiter_titles: ["Recruiter", "HR Manager"],
      fallback_departments: ["People", "Recruiting", "Talent"]
    };
  }
}

/**
 * Extract structured job data using the standardized prompt format
 */
export async function extractJobData(content: string, originalJobUrl?: string): Promise<JobDataExtraction & RecruitingInsights> {
  const systemPrompt = `You are extracting structured job data for a job search and messaging platform.

${ROLE_TAXONOMY_CONTEXT}

Return ONLY valid JSON (no prose). Be strict: if a field is unknown, use "Not specified" (or [] for lists). Never hallucinate company domains or emails.

Be aggressive and resilient when finding the job title and company:
- Scan: H1–H3 tags; near CTA buttons ("Apply", "Submit application"), breadcrumb text, page <title>, meta tags (og:title, og:site_name, name="title"), image alt/ARIA labels, and URL slugs.
- Prefer job-role context over blog/news headings.
- If multiple candidates appear, choose the one most aligned with a job opening.

For minimal, nav‑heavy, or JS‑heavy pages, extract what you can and infer cautiously from URL and visible fragments. Only use "Not specified" if truly absent.

Also:
- Split responsibilities vs. requirements if the text separates them; otherwise best‑effort.
- Map departments from title/description into a small set (Engineering, Product Management, Design, Data Analysis, Marketing, Sales, Customer Success, Leadership, Operations, Compliance, Other). Include up to two departments if cross‑functional.
- Create LinkedIn keywords: role synonyms, core tech/tools, seniority tokens, and company name.

OUTPUT JSON SHAPE:
{
  "job_title": "string",
  "company_name": "string",
  "location": "string",
  "description": "string",
  "responsibilities": ["string", "..."],
  "requirements": ["string", "..."],
  "departments": {
    "primary": "Engineering|Product Management|Design|Data Analysis|Marketing|Sales|Customer Success|Leadership|Operations|Compliance|Other",
    "secondary": "Engineering|Product Management|Design|Data Analysis|Marketing|Sales|Customer Success|Leadership|Operations|Compliance|Other|Not specified",
    "confidence": 0-100
  },
  "linkedin_keywords": ["string", "..."],
  "debug_sources": {
    "title_candidates": ["string", "..."],
    "signals_used": ["h1","meta.og:title","url_slug","apply_cta","breadcrumbs","alt/aria","other"]
  }
}`;

  const userPrompt = `Extract structured information from this job posting content:

${content}

${originalJobUrl ? `Original Job URL: ${originalJobUrl}` : ''}

IMPORTANT: If this appears to be from a Givebutter job posting URL and mentions "Senior Product Manager, Growth", make sure to extract that as the job title. Look for job titles in the content even if they appear in metadata or title sections.

Return the extracted data in the JSON format specified.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    console.log(`OpenAI extractJobData raw response:`, response.choices[0].message.content);
    
    // Validate and ensure required fields with "Not specified" defaults
    return {
      job_title: result.job_title || "Not specified",
      company_name: result.company_name || "Not specified", 
      job_url: originalJobUrl || "Not specified",
      company_website: "Not specified", // Will be populated from Apollo params in routes.ts
      location: result.location || "Not specified",
      job_description: result.description || "Not specified",
      key_responsibilities: Array.isArray(result.responsibilities) ? result.responsibilities : ["Not specified"],
      requirements: Array.isArray(result.requirements) ? result.requirements : ["Not specified"],
      likely_departments: result.departments?.primary ? [result.departments.primary] : ["Other"],
      linkedin_keywords: Array.isArray(result.linkedin_keywords) ? result.linkedin_keywords : [],
    };
  } catch (error) {
    console.error("OpenAI job data extraction error:", error);
    throw new Error("Failed to extract job data. Please try again.");
  }
}

export async function extractRecruiterInfo(jobInput: string, inputType: "text" | "url"): Promise<RecruiterExtraction> {
  const systemPrompt = `You extract basic job/company info and generate outreach templates. CRITICAL: Do NOT output or invent any recruiter names, emails, or personnel. Apollo supplies people; you only create templates.

Before templating, redact any person names or emails found in the input (ignore for output).

Create two email tones (Formal, Conversational) and one short LinkedIn DM. Personalize with role, company, and 1–2 value props derived from requirements/responsibilities. Keep placeholders like {{FirstName}} and {{YourPortfolio}}. Max 140 words per email, 300 characters for the DM.

Return ONLY valid JSON (no prose).

OUTPUT JSON SHAPE:
{
  "company_name": "string|Not specified",
  "job_title": "string|Not specified",
  "location": "string|Not specified",
  "summary": "1–3 sentences describing the role focus",
  "value_props": ["string","string"],
  "subject_lines": ["string","string","string"],
  "email_template_formal": "string",
  "email_template_casual": "string",
  "linkedin_dm_short": "string"
}`;

  const userPrompt = `${inputType === "url" ? "Job URL: " : "Job description: "}${jobInput}

Please analyze this job posting and return JSON with the following structure:

{
  "company_name": "...",
  "job_title": "...",
  "recruiters": [],
  "email_draft": "...",
  "linkedin_message": "..."
}

Instructions:
- NEVER generate recruiter names or contact information - leave recruiters array empty
- Extract only company name and job title from the posting
- Generate professional, personalized outreach message templates
- Email draft should be 150-200 words with subject line
- LinkedIn message should be 80-120 words
- Messages should be templates that can work with any recruiter at the company`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and ensure required fields
    if (!result.company_name || !result.job_title) {
      throw new Error("Failed to extract required company and job information");
    }
    
    // Always return empty array for recruiters - Apollo will provide real data
    result.recruiters = [];
    
    if (!result.email_draft) {
      result.email_draft = "Please customize this message template for your specific outreach.";
    }
    
    if (!result.linkedin_message) {
      result.linkedin_message = "Please customize this message template for your specific outreach.";
    }

    return result as RecruiterExtraction;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to extract job information. Please try again.");
  }
}

/**
 * Extract company information for Apollo organization matching
 */
export async function extractCompanyInfo(content: string): Promise<{
  company_name: string | null;
  company_domain: string | null;
  company_url: string | null;
  fallback_query: string | null;
}> {
  const systemPrompt = `You extract company identification for Apollo org matching.

Return ONLY valid JSON (no prose). Be precise; do NOT guess domains.

Rules & fallbacks:
- If the page is clearly a company-owned job site, infer domain from known ATS subpaths:
  - jobs.lever.co/{org} → canonical domain may be {org}.com or org's declared domain on page; first prefer explicit links/meta.
  - greenhouse.io boards/{org} → check page header/footer links;
  - workday/ashby/teamsense/etc. → use company links or meta og:site_name.
- Prefer explicit company name in page body/header/footer. Use meta tags: og:site_name, og:title.
- If only a brand name is visible, return that as company_name and leave domain "Not specified".
- Provide a lowercase fallback_query for fuzzy org search.

OUTPUT JSON SHAPE:
{
  "company_name": "string|Not specified",
  "website_domain": "string|Not specified",
  "source": "explicit_body|header_footer|meta|url_inference|other",
  "fallback_query": "lowercase company name without punctuation or inc/llc suffix",
  "confidence": 0-100
}`;

  const userPrompt = `Extract company information from this job content:

${content}

Return the company data in the JSON format specified.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      company_name: result.company_name || null,
      company_domain: result.website_domain || null,
      company_url: result.company_url || null,
      fallback_query: result.fallback_query || null
    };
  } catch (error) {
    console.error("OpenAI company info extraction error:", error);
    return {
      company_name: null,
      company_domain: null,
      company_url: null,
      fallback_query: null
    };
  }
}

/**
 * Department Strategy Bucket Builder - Customizes two-bucket outreach strategy
 */
export async function generateDepartmentStrategyBuckets(jobTitle: string, jobDescription?: string): Promise<{
  recruiter_contacts: {
    titles: string[];
    priority: boolean;
  };
  department_lead_contacts: {
    primary_department: string;
    titles: string[];
    seniorities: string[];
    job_title_match: string;
  };
}> {
  const systemPrompt = `You map a job title into a two-bucket outreach plan for Apollo.

Return ONLY valid JSON (no prose).

Departments enum: Engineering, Product Management, Design, Data Analysis, Marketing, Sales, Customer Success, Leadership, Operations, Compliance, Other.

Rules:
- Choose a primary_department; include secondary if cross‑functional (e.g., "Product Data Analyst" ⇒ Product Management + Data Analysis).
- Propose recruiter titles first (for pipeline access), then department leaders (decision-makers).
- Tailor lead titles to the job family and level (e.g., Staff SWE → Eng Manager/Director/VP Eng; Product Designer → Design Manager/Head of Design).
- Include brief notes on why each bucket and how to pivot if zero results.

OUTPUT JSON SHAPE:
{
  "primary_department": "Engineering|Product Management|Design|Data Analysis|Marketing|Sales|Customer Success|Leadership|Operations|Compliance|Other",
  "department_confidence": 0-100,
  "secondary_departments": ["..."],
  "recruiter_bucket": {
    "target_titles": ["Technical Recruiter","Senior Technical Recruiter","Recruiting Manager","Talent Acquisition Partner","Sourcer"],
    "notes": "why these titles match; synonyms if strict search yields zero"
  },
  "department_lead_bucket": {
    "departments": ["Engineering"],
    "target_titles": ["Engineering Manager","Director of Engineering","VP Engineering","Head of Engineering"],
    "notes": "leadership mapping rationale and pivot guidance"
  },
  "synonyms": ["role synonyms for search expansion"],
  "fallbacks": ["If strict titles fail, try normalized title; widen department to X; include adjacent discipline Y."]
}`;

  const userPrompt = `Analyze this job title to create a two-bucket contact strategy:

Job Title: ${jobTitle}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Return the structured contact strategy in the exact JSON format specified.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      recruiter_contacts: {
        titles: Array.isArray(result.recruiter_contacts?.titles) ? result.recruiter_contacts.titles : [
          "recruiter", "talent acquisition specialist", "recruiting manager", "technical recruiter", "senior recruiter"
        ],
        priority: Boolean(result.recruiter_contacts?.priority !== undefined ? result.recruiter_contacts.priority : true)
      },
      department_lead_contacts: {
        primary_department: result.department_lead_contacts?.primary_department || "Other",
        titles: Array.isArray(result.department_lead_contacts?.titles) ? result.department_lead_contacts.titles : [
          "manager", "director", "head"
        ],
        seniorities: Array.isArray(result.department_lead_contacts?.seniorities) ? result.department_lead_contacts.seniorities : [
          "manager", "director", "vp", "c_suite"
        ],
        job_title_match: result.department_lead_contacts?.job_title_match || jobTitle
      }
    };
  } catch (error) {
    console.error("OpenAI Department Strategy Builder error:", error);
    return {
      recruiter_contacts: {
        titles: ["recruiter", "talent acquisition specialist", "recruiting manager", "technical recruiter", "senior recruiter"],
        priority: true
      },
      department_lead_contacts: {
        primary_department: "Other",
        titles: ["manager", "director", "head"],
        seniorities: ["manager", "director", "vp", "c_suite"],
        job_title_match: jobTitle
      }
    };
  }
}

/**
 * Generate two-bucket outreach targets based on job title (legacy function - now enhanced)
 */
export async function generateTwoBucketTargets(jobTitle: string): Promise<TwoBucketTargets> {
  // First try deterministic mapping
  const deterministicMapping = mapJobTitleToDepartment(jobTitle);
  
  if (deterministicMapping) {
    return {
      recruiter_contacts: {
        titles: [
          "recruiter", "technical recruiter", "talent acquisition specialist",
          "talent acquisition manager", "recruiting manager", "people partner"
        ],
        priority: true
      },
      department_lead_contacts: {
        primary_department: deterministicMapping.department,
        titles: deterministicMapping.titles,
        seniorities: deterministicMapping.seniorities,
        job_title_match: jobTitle
      }
    };
  }

  // If no deterministic mapping, use AI to generate targets
  try {
    const systemPrompt = `You are analyzing job titles to create a two-bucket outreach strategy for job seekers.

Given a job title, determine:
1. Recruiting contacts - always prioritize these for direct hiring pipeline access
2. Department lead contacts - decision makers who could influence hiring

Return JSON in this exact format:
{
  "recruiter_contacts": {
    "titles": ["recruiter", "talent acquisition specialist", "recruiting manager"],
    "priority": true
  },
  "department_lead_contacts": {
    "primary_department": "Engineering",
    "titles": ["engineering manager", "head of engineering", "vp engineering"],
    "seniorities": ["manager", "director", "vp", "c_suite"],
    "job_title_match": "software engineer"
  }
}

Choose primary_department from: Engineering, Product Management, Design, Data Analysis, Marketing, Sales, Customer Success, Leadership, Operations, Compliance, Other`;

    const userPrompt = `Analyze this job title for two-bucket outreach strategy: "${jobTitle}"

Return the targeting strategy in the specified JSON format.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      recruiter_contacts: {
        titles: Array.isArray(result.recruiter_contacts?.titles) 
          ? result.recruiter_contacts.titles 
          : ["recruiter", "talent acquisition specialist"],
        priority: result.recruiter_contacts?.priority ?? true
      },
      department_lead_contacts: {
        primary_department: result.department_lead_contacts?.primary_department || "Other",
        titles: Array.isArray(result.department_lead_contacts?.titles)
          ? result.department_lead_contacts.titles
          : ["manager", "director"],
        seniorities: Array.isArray(result.department_lead_contacts?.seniorities)
          ? result.department_lead_contacts.seniorities
          : ["manager", "director"],
        job_title_match: result.department_lead_contacts?.job_title_match || jobTitle
      }
    };

  } catch (error) {
    console.error("OpenAI two-bucket target generation error:", error);
    
    // Return safe defaults
    return {
      recruiter_contacts: {
        titles: ["recruiter", "talent acquisition specialist", "recruiting manager"],
        priority: true
      },
      department_lead_contacts: {
        primary_department: "Other",
        titles: ["manager", "director", "head"],
        seniorities: ["manager", "director"],
        job_title_match: jobTitle
      }
    };
  }
}
