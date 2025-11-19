import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface MessageGenerationParams {
  recruiterName: string;
  recruiterTitle: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  recruiterEmail?: string | null;
}

interface GeneratedMessages {
  emailSubject: string;
  emailContent: string;
  linkedinContent: string;
}

export async function generatePersonalizedMessages(params: MessageGenerationParams): Promise<GeneratedMessages> {
  const prompt = `
Generate personalized outreach messages for a job seeker contacting a recruiter. Create both an email and LinkedIn message that are professional, engaging, and tailored to the specific context.

Context:
- Recruiter: ${params.recruiterName} (${params.recruiterTitle})
- Company: ${params.companyName}
- Job Position: ${params.jobTitle}
- Recruiter Email: ${params.recruiterEmail || "Not provided"}

Job Description Summary:
${params.jobDescription.slice(0, 1000)}...

Requirements:
1. EMAIL: Create a complete email with subject line and body (300-400 words max)
   - Professional tone but warm and engaging
   - Personalized to the recruiter and role
   - Highlight relevant skills/experience
   - Clear call-to-action
   - Include a compelling subject line

2. LINKEDIN: Create a LinkedIn message (250 words max)
   - Conversational but professional
   - Shorter and more direct than email
   - Reference mutual connection to the company/role
   - Easy to respond to

Output format (JSON):
{
  "emailSubject": "Subject line for the email",
  "emailContent": "Full email body content",
  "linkedinContent": "LinkedIn message content"
}

Important: Make messages genuine and personal, not generic templates. Reference specific aspects of the role or company when possible.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert career coach and professional writer who creates compelling, personalized outreach messages for job seekers. Your messages are authentic, engaging, and result in high response rates."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      emailSubject: result.emailSubject || "Interested in discussing the " + params.jobTitle + " role",
      emailContent: result.emailContent || "Generated content not available",
      linkedinContent: result.linkedinContent || "Generated content not available"
    };
  } catch (error) {
    console.error("Error generating personalized messages:", error);
    
    // Fallback messages
    return {
      emailSubject: `Interested in the ${params.jobTitle} position at ${params.companyName}`,
      emailContent: `Hi ${params.recruiterName},\n\nI hope this email finds you well. I came across the ${params.jobTitle} position at ${params.companyName} and I'm very interested in learning more about this opportunity.\n\nI'd love to discuss how my background and experience could contribute to your team. Would you be available for a brief conversation about this role?\n\nThank you for your time and consideration.\n\nBest regards`,
      linkedinContent: `Hi ${params.recruiterName}, I saw the ${params.jobTitle} opening at ${params.companyName} and I'm very interested. Would you be open to a brief conversation about this opportunity?`
    };
  }
}