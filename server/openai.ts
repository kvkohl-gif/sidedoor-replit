import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

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

export async function extractRecruiterInfo(jobInput: string, inputType: "text" | "url"): Promise<RecruiterExtraction> {
  const systemPrompt = `You are an expert assistant that extracts recruiter contact information and generates personalized outreach messages from job descriptions. 

Your task is to:
1. Identify potential recruiter or hiring manager contacts
2. Extract company and job information
3. Generate professional outreach messages

Always respond with valid JSON in the exact format specified.`;

  const userPrompt = `${inputType === "url" ? "Job URL: " : "Job description: "}${jobInput}

Please analyze this job posting and return JSON with the following structure:

{
  "company_name": "...",
  "job_title": "...",
  "recruiters": [
    { "name": "...", "title": "...", "email": "...", "linkedin_url": "...", "confidence_score": 0-100 },
    {...}
  ],
  "email_draft": "...",
  "linkedin_message": "..."
}

Instructions:
- Extract up to 3 potential recruiter/hiring contacts
- Confidence score should reflect how likely this person is to be the actual recruiter (0-100)
- Generate professional, personalized outreach messages
- If information is not available, use reasonable professional estimates based on the company and role
- Email draft should be 150-200 words
- LinkedIn message should be 80-120 words
- Include proper subject line in email draft`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and ensure required fields
    if (!result.company_name || !result.job_title) {
      throw new Error("Failed to extract required company and job information");
    }
    
    if (!result.recruiters || !Array.isArray(result.recruiters)) {
      result.recruiters = [];
    }
    
    if (!result.email_draft) {
      result.email_draft = "Please customize this message for your specific situation.";
    }
    
    if (!result.linkedin_message) {
      result.linkedin_message = "Please customize this message for your specific situation.";
    }

    return result as RecruiterExtraction;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to extract recruiter information. Please try again.");
  }
}
