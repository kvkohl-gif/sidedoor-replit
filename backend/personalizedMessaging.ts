import { callClaude } from "./claude";

interface MessageGenerationParams {
  recruiterName: string;
  recruiterTitle: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  recruiterEmail?: string | null;
  // Outreach profile fields for personalization
  userBio?: string;
  userAchievements?: string[];
  userStoryHooks?: string[];
  userCareerGoals?: string;
  voiceFormality?: number;
  voiceDirectness?: number;
  voiceLength?: number;
  voiceNotes?: string;
}

interface GeneratedMessages {
  emailSubject: string;
  emailContent: string;
  linkedinContent: string;
}

export async function generatePersonalizedMessages(params: MessageGenerationParams): Promise<GeneratedMessages> {
  // Build voice instruction from slider values
  const voiceInstruction = [
    (params.voiceFormality ?? 0.5) < 0.3 ? 'Casual, conversational tone.' : (params.voiceFormality ?? 0.5) > 0.7 ? 'Formal, polished tone.' : '',
    (params.voiceDirectness ?? 0.5) > 0.7 ? 'Direct — get to the point fast.' : (params.voiceDirectness ?? 0.5) < 0.3 ? 'Warm — build rapport before the ask.' : '',
    (params.voiceLength ?? 0.3) > 0.6 ? 'Full length with detail.' : (params.voiceLength ?? 0.3) < 0.2 ? 'Extremely brief.' : 'Concise.',
    params.voiceNotes ? `Voice notes: ${params.voiceNotes}` : ''
  ].filter(Boolean).join(' ');

  // Build profile context block
  const profileLines = [
    params.userBio ? `About the sender: ${params.userBio}` : '',
    params.userAchievements?.length ? `Key achievements:\n${params.userAchievements.slice(0, 3).map(a => `- ${a}`).join('\n')}` : '',
    params.userStoryHooks?.length ? `Personal hooks for rapport: ${params.userStoryHooks.slice(0, 2).join('; ')}` : '',
    params.userCareerGoals ? `Career direction: ${params.userCareerGoals}` : ''
  ].filter(Boolean).join('\n\n');

  const firstName = params.recruiterName.split(' ')[0];

  const prompt = `Generate outreach messages for a job seeker. Return JSON with emailSubject, emailContent, linkedinContent.

TARGET:
- Recruiter: ${params.recruiterName} (${params.recruiterTitle})
- Company: ${params.companyName}
- Job: ${params.jobTitle}

JOB DESCRIPTION (first 800 chars):
${params.jobDescription.slice(0, 800)}

${profileLines ? `SENDER PROFILE:\n${profileLines}` : '(No profile available — write generic but still authentic messages)'}

${voiceInstruction ? `VOICE: ${voiceInstruction}` : ''}

EMAIL RULES (3 paragraphs, 75-125 words total):
1. Personal hook — reference something specific about ${params.companyName}, the role, or use a story hook. NO "I hope this email finds you well."
2. Value match — 1-2 specific experiences/achievements that map to this role. Not a resume dump.
3. Soft CTA — "Would love to chat" not "Please review my resume."
- Greeting: "Hi ${firstName},"
- Sign off: "Best,\\n[Your Name]"
- Subject line: under 7 words, specific to role/company. No "Regarding" or "Re:" prefix.

LINKEDIN RULES (under 200 characters):
- One conversational sentence + question
- Reference something specific
- Make it easy to say yes

OUTPUT (JSON):
{
  "emailSubject": "...",
  "emailContent": "...",
  "linkedinContent": "..."
}`;

  try {
    const raw = await callClaude({
      system: "You write authentic cold outreach that sounds human, not templated. Every message has something specific. You never use cliches like 'I hope this finds you well', 'I am writing to express', or 'exciting opportunity'. Your emails consistently get responses because they feel personal and genuine.",
      user: prompt,
      jsonMode: true,
      temperature: 0.7,
      maxTokens: 1500,
    });

    const result = JSON.parse(raw);

    return {
      emailSubject: result.emailSubject || `${params.jobTitle} at ${params.companyName}`,
      emailContent: result.emailContent || "Generated content not available",
      linkedinContent: result.linkedinContent || "Generated content not available"
    };
  } catch (error) {
    console.error("Error generating personalized messages:", error);

    return {
      emailSubject: `${params.jobTitle} at ${params.companyName}`,
      emailContent: `Hi ${firstName},\n\nI came across the ${params.jobTitle} role at ${params.companyName} and it caught my attention. I'd love to learn more about the team and how my background could be a fit.\n\nWould you be open to a brief conversation?\n\nBest,\n[Your Name]`,
      linkedinContent: `Hi ${firstName}, saw the ${params.jobTitle} role at ${params.companyName} — would love to chat about it. Open to connecting?`
    };
  }
}
