import OpenAI from "openai";

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
  job_title: string | undefined;
  domain: string | undefined;
  company_name: string | undefined;
  location: string | undefined;
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
      job_title: result.job_title || undefined,
      domain: result.domain || undefined,
      company_name: result.company_name || undefined,
      location: result.location || undefined,
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
      job_title: undefined,
      domain: undefined,
      company_name: undefined,
      location: undefined,
      relevant_departments: [],
      person_titles: [],
      person_seniorities: [],
      organization_locations: [],
      job_country: undefined,
      job_region: undefined,
      company_hq_country: undefined,
      remote_hiring_countries: [],
      is_remote_job: false
    };
  }
}

/**
 * Extract structured job data using the standardized prompt format
 */
export async function extractJobData(content: string, originalJobUrl?: string): Promise<JobDataExtraction & RecruitingInsights> {
  const systemPrompt = `You are extracting structured job data for a job search and messaging platform.

Given a job description (or URL scrape), return a clearly structured JSON object exactly in the format below.

❗️All fields are required — if the data is missing, return "Not specified" or infer if reasonably possible.

Return the data in this exact JSON structure:

{
  "job_title": "Title of the role",
  "company_name": "Company Name", 
  "job_url": "Paste exact URL if given. If missing, return 'Not specified'",
  "company_website": "Find official website of the company. Use best guess from name or job URL domain if not specified",
  "location": "City, Country or Remote – Country format",
  "job_description": "Brief paragraph of 3–5 sentences summarizing the job",
  "key_responsibilities": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
  "requirements": ["Requirement bullet 1", "Requirement bullet 2", "Requirement bullet 3"],
  "likely_departments": ["Choose 3–5 from: Product Management, Engineering, Design, Data Analysis, Marketing, Sales, Customer Success, Leadership, Operations, Compliance, Other"],
  "linkedin_keywords": ["Keywords for LinkedIn searches related to this role"]
}

Do NOT hallucinate information. Only use what's visible in the source content. If fields are missing, return "Not specified".`;

  const userPrompt = `Extract structured information from this job posting content:

${content}

${originalJobUrl ? `Original Job URL: ${originalJobUrl}` : ''}

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
    
    // Validate and ensure required fields with "Not specified" defaults
    return {
      job_title: result.job_title || "Not specified",
      company_name: result.company_name || "Not specified",
      job_url: result.job_url || originalJobUrl || "Not specified",
      company_website: result.company_website || "Not specified",
      location: result.location || "Not specified",
      job_description: result.job_description || "Not specified",
      key_responsibilities: Array.isArray(result.key_responsibilities) ? result.key_responsibilities : ["Not specified"],
      requirements: Array.isArray(result.requirements) ? result.requirements : ["Not specified"],
      likely_departments: Array.isArray(result.likely_departments) ? result.likely_departments : ["Other"],
      linkedin_keywords: Array.isArray(result.linkedin_keywords) ? result.linkedin_keywords : [],
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

/**
 * Generate two-bucket outreach targets based on job title
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
