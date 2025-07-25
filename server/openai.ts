import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

export interface JobDataExtraction {
  job_title: string;
  company_name: string;
  job_description: string;
  responsibilities: string[];
  requirements: string[];
  location: string;
  recruiter_keywords_section: string;
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

/**
 * Extract recruiter name explicitly mentioned in job description
 */
export async function extractRecruiterName(content: string): Promise<RecruiterNameExtraction> {
  const systemPrompt = `You are a job contact extractor. From a job description or webpage HTML, extract the name of any recruiter or hiring contact explicitly listed. 

Look for phrases like:
- "Contact [Name]"
- "Apply to [Name]" 
- "Questions? Reach out to [Name]"
- "Recruiter: [Name]"
- "Hiring Manager: [Name]"
- "For more information, contact [Name]"

Your output should be in this exact JSON format:
{
  "recruiter_name": "Christopher Graham",
  "title": "Lead Recruiter", 
  "source_type": "job_description",
  "company_name": "SprintFWD",
  "contact_info": {
    "email": "chris@sprintfwd.com",
    "phone": "+1-555-123-4567",
    "linkedin": "https://linkedin.com/in/christophergraham"
  }
}

If no recruiter name is explicitly mentioned, return:
{
  "recruiter_name": null,
  "title": null,
  "source_type": "job_description", 
  "company_name": null
}

Only extract names that are clearly identified as recruiters, hiring managers, or contact persons. Do not guess or infer names from general company information.`;

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
    return extraction as RecruiterNameExtraction;
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
 * Extract Apollo search parameters from job content
 */
export async function extractApolloSearchParams(content: string): Promise<{
  job_title: string | null;
  domain: string | null;
  company_name: string | null;
  location: string | null;
  relevant_departments: string[];
  person_titles: string[];
  person_seniorities: string[];
  organization_locations: string[];
  job_country?: string;
  job_region?: string;
  company_hq_country?: string;
  remote_hiring_countries?: string[];
  is_remote_job?: boolean;
}> {
  const systemPrompt = `You are a data extraction AI that helps prepare accurate and structured inputs for an Apollo People Search query with geographic filtering capabilities.
Only extract clearly stated facts from the provided job description or URL content.
Do not guess or infer — if a value is not explicitly mentioned, return null.

Your job is to extract Apollo search parameters with geographic context in this exact format:

{
  "job_title": "[Exact role title from the listing]",
  "domain": "[Company domain, e.g. wave.com]",
  "company_name": "[Company name if present]",
  "location": "[City or country if listed]",
  "relevant_departments": ["People", "Recruiting", "Talent", "HR", "Product", "Engineering", "Growth"],
  "person_titles": [
    "Technical Recruiter",
    "Senior Recruiter", 
    "Talent Acquisition Manager",
    "Head of Talent",
    "Director of Recruiting",
    "People Operations Manager"
  ],
  "person_seniorities": ["manager", "head", "director", "vp", "c_suite"],
  "organization_locations": ["[If present, use HQ city or country]"],
  "job_country": "[Country where the job is located]",
  "job_region": "[State/region/province where job is located]",
  "company_hq_country": "[Country where company is headquartered]",
  "remote_hiring_countries": ["[Countries where company hires remotely]"],
  "is_remote_job": true/false
}

Do not return any names or emails. Do not make assumptions.
This prompt is used as a first step to enrich data using Apollo's API, so accuracy matters more than completeness.`;

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
      job_title: result.job_title || null,
      domain: result.domain || null,
      company_name: result.company_name || null,
      location: result.location || null,
      relevant_departments: Array.isArray(result.relevant_departments) ? result.relevant_departments : [],
      person_titles: Array.isArray(result.person_titles) ? result.person_titles : [],
      person_seniorities: Array.isArray(result.person_seniorities) ? result.person_seniorities : [],
      organization_locations: Array.isArray(result.organization_locations) ? result.organization_locations : [],
      job_country: result.job_country || null,
      job_region: result.job_region || null,
      company_hq_country: result.company_hq_country || null,
      remote_hiring_countries: Array.isArray(result.remote_hiring_countries) ? result.remote_hiring_countries : [],
      is_remote_job: Boolean(result.is_remote_job)
    };
  } catch (error) {
    console.error("OpenAI Apollo params extraction error:", error);
    return {
      job_title: null,
      domain: null,
      company_name: null,
      location: null,
      relevant_departments: [],
      person_titles: [],
      person_seniorities: [],
      organization_locations: [],
      job_country: null,
      job_region: null,
      company_hq_country: null,
      remote_hiring_countries: [],
      is_remote_job: false
    };
  }
}

/**
 * Extract structured job data using the enhanced OpenAI prompt
 */
export async function extractJobData(content: string): Promise<JobDataExtraction & RecruitingInsights> {
  const systemPrompt = `You are an intelligent job data extractor. Given the full content of a job listing page from a company career site, your job is to extract key structured information about the role and the company. Use only the content from the page. Do not make up any data.

Return the result in structured JSON format with the following fields:

{
  "job_title": [exact title as listed on the page],
  "company_name": [company name as listed],
  "job_description": [concise summary of the role from the page],
  "responsibilities": [array of 3–6 bullet points summarizing the key responsibilities],
  "requirements": [array of 3–6 bullet points listing the qualifications or skills],
  "location": [location listed, or "Remote" if stated],
  "recruiter_keywords_section": [text block containing team, recruiter, or contact info if present],
  "linkedin_keywords": [comma-separated list of names or titles of any people mentioned],
  "likely_departments": [guess one or more departments involved, like "People Team", "Talent Acquisition", "Recruiting", "Product Team"]
}

Do NOT hallucinate information. Only use what's visible in the source content. If fields are missing, leave them blank.`;

  const userPrompt = `Extract structured information from this job posting content:

${content}

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
    
    // Validate and ensure required fields
    return {
      job_title: result.job_title || "Unknown Position",
      company_name: result.company_name || "Unknown Company",
      job_description: result.job_description || "",
      responsibilities: Array.isArray(result.responsibilities) ? result.responsibilities : [],
      requirements: Array.isArray(result.requirements) ? result.requirements : [],
      location: result.location || "",
      recruiter_keywords_section: result.recruiter_keywords_section || "",
      linkedin_keywords: Array.isArray(result.linkedin_keywords) ? result.linkedin_keywords : [],
      likely_departments: Array.isArray(result.likely_departments) ? result.likely_departments : [],
    };
  } catch (error) {
    console.error("OpenAI job data extraction error:", error);
    throw new Error("Failed to extract job data. Please try again.");
  }
}

export async function extractRecruiterInfo(jobInput: string, inputType: "text" | "url"): Promise<RecruiterExtraction> {
  const systemPrompt = `You are an assistant that extracts company information and generates outreach messages from job descriptions.

CRITICAL: Do NOT generate recruiter names, contacts, or personnel information. Apollo API will provide real recruiter data.

Your task is to:
1. Extract basic company and job information ONLY
2. Generate professional email and LinkedIn message templates

Always respond with valid JSON in the exact format specified.`;

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
