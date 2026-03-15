import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI() { if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy" }); return _openai; }
const openai = new Proxy({} as OpenAI, { get(_, p) { return (getOpenAI() as any)[p]; } });

export interface EmailSuggestion {
  name: string;
  original_email: string;
  suggested_email: string;
  confidence_reasoning: string;
}

export interface PatternAnalysisResult {
  suggestions: EmailSuggestion[];
  verified_pattern?: string;
  analysis_summary: string;
}

export async function analyzeEmailPatterns(
  contacts: Array<{
    name: string;
    email: string;
    verificationStatus: string;
    emailVerified: boolean;
  }>,
  companyDomain: string
): Promise<PatternAnalysisResult> {
  try {
    // Separate verified and risky contacts
    const verifiedContacts = contacts.filter(c => 
      c.emailVerified && c.verificationStatus === "valid"
    );
    
    const riskyContacts = contacts.filter(c => 
      !c.emailVerified || c.verificationStatus === "risky" || c.verificationStatus === "catchall"
    );

    // If no risky contacts, return early
    if (riskyContacts.length === 0) {
      return {
        suggestions: [],
        analysis_summary: "All emails are verified - no suggestions needed."
      };
    }

    // Prepare the prompt
    const verifiedSection = verifiedContacts.length > 0 
      ? `Verified:\n${verifiedContacts.map(c => `- ${c.name}: ${c.email} (Verified)`).join('\n')}\n\n`
      : "No verified emails available.\n\n";

    const riskySection = `Risky:\n${riskyContacts.map(c => 
      `- ${c.name}: ${c.email} (${c.verificationStatus || 'Risky'})`
    ).join('\n')}\n\n`;

    const prompt = `Here are recruiter contacts for ${companyDomain}:

${verifiedSection}${riskySection}Please analyze the email patterns and suggest improvements for risky emails. Return a JSON array with this structure:
[
  {
    "name": "Full Name",
    "original_email": "original@company.com",
    "suggested_email": "suggested@company.com",
    "confidence_reasoning": "Explanation of why this suggestion is likely correct"
  }
]

Only suggest alternatives for risky emails. Base suggestions on verified patterns when available, or common professional email formats.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an intelligent assistant that evaluates and improves email contact data for job applicants. You identify patterns in verified email addresses and suggest alternatives when an email is marked 'risky' or unverifiable. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const aiResponse = response.choices[0].message.content;
    
    // Parse the response
    let suggestions: EmailSuggestion[] = [];
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(aiResponse || "{}");
      
      // Handle both array and object responses
      if (Array.isArray(parsedResponse)) {
        suggestions = parsedResponse;
      } else if (parsedResponse.suggestions && Array.isArray(parsedResponse.suggestions)) {
        suggestions = parsedResponse.suggestions;
      } else if (parsedResponse.emails && Array.isArray(parsedResponse.emails)) {
        suggestions = parsedResponse.emails;
      }
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      suggestions = [];
    }

    // Determine verified pattern
    let verifiedPattern = "";
    if (verifiedContacts.length > 0) {
      const email = verifiedContacts[0].email;
      const domain = email.split('@')[1];
      const localPart = email.split('@')[0];
      
      if (localPart.includes('.')) {
        verifiedPattern = `first.last@${domain}`;
      } else if (localPart.includes('_')) {
        verifiedPattern = `first_last@${domain}`;
      } else {
        verifiedPattern = `firstname@${domain}`;
      }
    }

    return {
      suggestions: suggestions.filter(s => s.name && s.original_email && s.suggested_email),
      verified_pattern: verifiedPattern,
      analysis_summary: `Analyzed ${contacts.length} contacts. Found ${verifiedContacts.length} verified emails and ${riskyContacts.length} risky emails. Generated ${suggestions.length} suggestions.`
    };

  } catch (error) {
    console.error("Email pattern analysis failed:", error);
    return {
      suggestions: [],
      analysis_summary: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}