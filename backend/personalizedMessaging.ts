import { callClaude } from "./claude";

/**
 * Side Door Outreach Message Generation Service
 * 
 * Research-backed framework for cold outreach to recruiters and hiring managers.
 * Based on data showing:
 *   - 75-125 word emails get 22% reply rate (vs 8% for 250+ words)
 *   - Personal connection hooks boost reply rates by 47%
 *   - Role-specific subject lines get 71% open rate (vs 23% for generic)
 *   - "Easy out" CTAs reduce reply friction significantly
 *   - Recruiter vs. hiring manager emails need fundamentally different approaches
 * 
 * Two frameworks:
 *   RECRUITER:      Connect -> Prove -> Bridge -> Easy Ask
 *   HIRING MANAGER: Observe -> Demonstrate -> Align -> Invite
 */

export interface MessageGenerationParams {
  recruiterName: string;
  recruiterTitle: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  recruiterEmail?: string | null;
  outreachBucket?: "recruiter" | "department_lead";
  // Outreach profile fields for personalization
  userBio?: string;
  userResume?: string;
  userAchievements?: string[];
  userStoryHooks?: string[];
  userCareerGoals?: string;
  userHobbies?: string[];
  voiceFormality?: number;
  voiceDirectness?: number;
  voiceLength?: number;
  voiceNotes?: string;
}

export interface GeneratedMessages {
  emailSubject: string;
  emailContent: string;
  linkedinContent: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildVoiceInstruction(params: MessageGenerationParams): string {
  return [
    (params.voiceFormality ?? 0.5) < 0.3
      ? 'Use a casual, conversational tone — like texting a professional contact.'
      : (params.voiceFormality ?? 0.5) > 0.7
        ? 'Use a polished, professional tone — but still human, not corporate.'
        : '',
    (params.voiceDirectness ?? 0.5) > 0.7
      ? 'Be direct — get to the point in the first sentence.'
      : (params.voiceDirectness ?? 0.5) < 0.3
        ? 'Be warm — build rapport and connection before making any ask.'
        : '',
    (params.voiceLength ?? 0.3) > 0.6
      ? 'Write at full length with supporting detail (up to 150 words).'
      : (params.voiceLength ?? 0.3) < 0.2
        ? 'Keep it extremely brief — under 75 words.'
        : 'Keep it concise — 75 to 125 words.',
    params.voiceNotes ? `Additional voice guidance: ${params.voiceNotes}` : '',
  ].filter(Boolean).join(' ');
}

function buildProfileContext(params: MessageGenerationParams): string {
  const sections: string[] = [];

  // Resume excerpt — richest source of specific, credible experience
  if (params.userResume && params.userResume.trim().length > 50) {
    const resumeExcerpt = params.userResume.trim().slice(0, 1200);
    sections.push(`RESUME EXCERPT (use for specific experience details):\n${resumeExcerpt}`);
  }

  if (params.userBio) {
    sections.push(`PROFESSIONAL BIO:\n${params.userBio}`);
  }

  if (params.userAchievements?.length) {
    sections.push(
      `KEY ACHIEVEMENTS (pick the ONE most relevant to this role):\n${params.userAchievements
        .slice(0, 5)
        .map((a) => `- ${a}`)
        .join('\n')}`
    );
  }

  if (params.userStoryHooks?.length) {
    sections.push(
      `PERSONAL STORY HOOKS (weave ONE of these into the opening — these are personal experiences, anecdotes, or connections that make the email feel human and memorable):\n${params.userStoryHooks
        .slice(0, 3)
        .map((h) => `- ${h}`)
        .join('\n')}`
    );
  }

  if (params.userHobbies?.length) {
    sections.push(
      `HOBBIES & INTERESTS (use ONLY if one directly connects to the company/role/contact):\n${params.userHobbies
        .slice(0, 4)
        .map((h) => `- ${h}`)
        .join('\n')}`
    );
  }

  if (params.userCareerGoals) {
    sections.push(`CAREER DIRECTION:\n${params.userCareerGoals}`);
  }

  return sections.length > 0 ? sections.join('\n\n') : '';
}

// ---------------------------------------------------------------------------
// System prompts — one per outreach bucket
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_RECRUITER = `You write cold outreach emails from job seekers TO recruiters. Your emails get replies because they feel like a real person wrote them — not a template, not AI.

CORE PRINCIPLES:
1. PERSONAL CONNECTION FIRST. The opening line should reference something personal about the sender's relationship to the company, product, or industry. A personal anecdote or experience (e.g., "I've been a [product] user since...") outperforms any "I saw your role on..." opener. This is the single biggest driver of reply rates.
2. ONE PROOF POINT. Pick the single most relevant achievement from the sender's profile/resume and tie it directly to a job requirement. Use specific numbers when available. Never dump multiple achievements.
3. BRIDGE TO THE ROLE. One sentence connecting sender's background to what the job description actually asks for. Show you read the JD.
4. EASY OUT CTA. End with low-pressure language that gives the recipient permission to redirect: "If you're the right person for this, I'd love a quick chat — or happy to be pointed in the right direction." This reduces reply friction dramatically.

NEVER USE: "I hope this finds you well", "I'm writing to express my interest", "exciting opportunity", "passionate about", "I believe I would be a great fit", "thrilled", "eager", corporate jargon, or any filler phrase.

SUBJECT LINE: Under 45 characters. Reference the company name + a specific hook. NOT generic like "Job Inquiry" or "Application for [Role]". Think: "Quick question about [Role] at [Company]" or "[Specific thing] + [Company]".`;

const SYSTEM_PROMPT_HIRING_MANAGER = `You write cold outreach emails from job seekers TO hiring managers and department leaders. These recipients make hiring decisions — your tone should be peer-to-peer, not supplicant. They respect domain expertise over enthusiasm.

CORE PRINCIPLES:
1. OBSERVE. Open with a specific observation about the company, their team, product, or a challenge in their domain. Show you understand their world — not just their job posting. Use a personal story hook if one connects naturally.
2. DEMONSTRATE DOMAIN EXPERTISE. Share ONE specific project or achievement that proves competence in their domain. Hiring managers care about "can this person do the work?" — use concrete metrics and outcomes from the sender's experience.
3. ALIGN. Connect the sender's career trajectory to what the team is building. Use the job description requirements to show fit, but frame it as mutual interest — "what you're building aligns with where I'm heading" — not "I need a job."
4. PEER-LEVEL INVITE. End with a conversation starter, not a job ask: "Would love to hear how your team is approaching [specific challenge from JD] — open to connecting?" This invites dialogue, not a transaction.

NEVER USE: "I hope this finds you well", "I'm writing to express my interest", "exciting opportunity", "passionate about", "I believe I would be a great fit", "thrilled", "eager", corporate jargon, or any filler phrase.

SUBJECT LINE: Under 45 characters. Reference something specific about their domain or team, not just the role title. Think: "[Specific domain topic] at [Company]" or "Your team's [specific initiative]".`;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildRecruiterPrompt(params: MessageGenerationParams, profileContext: string, voiceInstruction: string): string {
  const firstName = params.recruiterName.split(' ')[0];
  const jobDescExcerpt = params.jobDescription?.slice(0, 1500) || 'No job description available.';

  return `Generate a cold outreach email and LinkedIn connection request for a job seeker reaching out to a RECRUITER.

TARGET CONTACT:
- Name: ${params.recruiterName}
- Title: ${params.recruiterTitle}
- Company: ${params.companyName}
- Role being discussed: ${params.jobTitle}

JOB DESCRIPTION:
${jobDescExcerpt}

${profileContext ? `SENDER'S PROFILE:\n${profileContext}` : '(No profile available — write the best possible message using job description context only. Make it specific to the company/role, not generic.)'}

${voiceInstruction ? `VOICE & TONE: ${voiceInstruction}` : ''}

EMAIL STRUCTURE — "Connect > Prove > Bridge > Easy Ask":
1. CONNECT (1-2 sentences): Open with a personal hook to the COMPANY or PRODUCT — use a story hook from the sender's profile if available. If they use the product, mention it. If they have a personal connection to the industry, use it. This should feel like a human being, not an applicant. If no story hook exists, reference something specific from the job description that genuinely resonated.
2. PROVE (1-2 sentences): Pick the ONE most relevant achievement or experience from the sender's profile/resume. Include a specific metric or outcome if available. Tie it to a requirement from the job description.
3. BRIDGE (1 sentence): Explicitly connect what the sender has done to what the role needs. Reference a specific requirement or responsibility from the JD.
4. EASY ASK (1 sentence): Low pressure. Include an "easy out" — "If you're the right person for this, I'd love a quick chat — or happy to be pointed in the right direction."

FORMAT:
- Greeting: "Hi ${firstName},"
- Sign off: "Best,\\n[Your Name]"
- Total email body: 75-125 words (this is critical — shorter emails get 2x more replies)
- No bullet points in the email body
- No bold text or formatting

SUBJECT LINE:
- Under 45 characters
- Reference ${params.companyName} + something specific
- NOT "Application for..." or "Interested in..." — those get ignored
- Good examples: "Quick question about [Role] at [Company]", "[Specific topic] at [Company]"

LINKEDIN CONNECTION REQUEST:
- Under 300 characters (hard limit)
- One conversational sentence + question
- Reference something specific about the company or role
- Make it easy to say yes
- Do NOT repeat the email — this should feel different

Return JSON:
{
  "emailSubject": "...",
  "emailContent": "...",
  "linkedinContent": "..."
}`;
}

function buildHiringManagerPrompt(params: MessageGenerationParams, profileContext: string, voiceInstruction: string): string {
  const firstName = params.recruiterName.split(' ')[0];
  const jobDescExcerpt = params.jobDescription?.slice(0, 1500) || 'No job description available.';

  return `Generate a cold outreach email and LinkedIn connection request for a job seeker reaching out to a HIRING MANAGER / DEPARTMENT LEAD.

TARGET CONTACT:
- Name: ${params.recruiterName}
- Title: ${params.recruiterTitle} (this is the decision-maker, not a recruiter)
- Company: ${params.companyName}
- Role being discussed: ${params.jobTitle}

JOB DESCRIPTION:
${jobDescExcerpt}

${profileContext ? `SENDER'S PROFILE:\n${profileContext}` : '(No profile available — write the best possible message using job description context only. Demonstrate domain awareness.)'}

${voiceInstruction ? `VOICE & TONE: ${voiceInstruction}` : ''}

EMAIL STRUCTURE — "Observe > Demonstrate > Align > Invite":
1. OBSERVE (1-2 sentences): Open with a specific observation about the company, their product, their team, or a challenge in their domain. Use a personal story hook if one connects naturally to their world. Show you understand what they're building — not just that a role is open. Tone: peer-to-peer, not applicant-to-gatekeeper.
2. DEMONSTRATE (1-2 sentences): Share ONE specific project, metric, or outcome from the sender's experience that proves domain competence. This person cares about "can you do the work?" — answer that with evidence. Use the resume and achievements for specifics.
3. ALIGN (1 sentence): Connect the sender's career direction to what the team is building. Frame as mutual fit: "What you're building at [Company] aligns with where I'm heading" — not "I need a job."
4. INVITE (1 sentence): Peer-level conversation starter — "Would love to hear how your team is approaching [specific challenge from JD] — open to a quick chat?" This invites dialogue, not a transaction.

FORMAT:
- Greeting: "Hi ${firstName},"
- Sign off: "Best,\\n[Your Name]"
- Total email body: 75-125 words
- No bullet points in the email body
- No bold text or formatting
- Tone should feel like one professional reaching out to another — NOT like a job application

SUBJECT LINE:
- Under 45 characters
- Reference their domain or something specific to the team — not just the role title
- Good examples: "[Domain topic] at [Company]", "Your team's approach to [challenge]"

LINKEDIN CONNECTION REQUEST:
- Under 300 characters (hard limit)
- Peer-level tone
- Reference something domain-specific — a shared interest, their team's work, or a technical topic
- End with an easy question
- Do NOT repeat the email content

Return JSON:
{
  "emailSubject": "...",
  "emailContent": "...",
  "linkedinContent": "..."
}`;
}

// ---------------------------------------------------------------------------
// Main export — single entry point for all message generation
// ---------------------------------------------------------------------------

export async function generatePersonalizedMessages(params: MessageGenerationParams): Promise<GeneratedMessages> {
  const voiceInstruction = buildVoiceInstruction(params);
  const profileContext = buildProfileContext(params);

  const isHiringManager = params.outreachBucket === 'department_lead';
  const systemPrompt = isHiringManager ? SYSTEM_PROMPT_HIRING_MANAGER : SYSTEM_PROMPT_RECRUITER;
  const userPrompt = isHiringManager
    ? buildHiringManagerPrompt(params, profileContext, voiceInstruction)
    : buildRecruiterPrompt(params, profileContext, voiceInstruction);

  const firstName = params.recruiterName.split(' ')[0];

  try {
    const raw = await callClaude({
      system: systemPrompt,
      user: userPrompt,
      jsonMode: true,
      temperature: 0.7,
      maxTokens: 1500,
    });

    const result = JSON.parse(raw);

    // Validate and enforce constraints
    let emailContent = result.emailContent || '';
    let linkedinContent = result.linkedinContent || '';
    let emailSubject = result.emailSubject || '';

    // Truncate LinkedIn to 300 chars if AI exceeded limit
    if (linkedinContent.length > 300) {
      linkedinContent = linkedinContent.slice(0, 297) + '...';
    }

    // Truncate subject to 45 chars if exceeded
    if (emailSubject.length > 50) {
      // Allow slight overflow but not excessive
      emailSubject = emailSubject.slice(0, 50);
    }

    return {
      emailSubject: emailSubject || `${params.jobTitle} at ${params.companyName}`,
      emailContent: emailContent || 'Generated content not available',
      linkedinContent: linkedinContent || 'Generated content not available',
    };
  } catch (error) {
    console.error('Error generating personalized messages:', error);

    // Fallback — still better than nothing
    return {
      emailSubject: `Quick question about ${params.jobTitle} at ${params.companyName}`.slice(0, 50),
      emailContent: `Hi ${firstName},\n\nI came across the ${params.jobTitle} role at ${params.companyName} and wanted to reach out — not just because of the role itself, but because of what your team is building.\n\nI'd love to learn more about how my background could be a fit. If you're the right person for this, I'd be grateful for a quick chat — or happy to be pointed in the right direction.\n\nBest,\n[Your Name]`,
      linkedinContent: `Hi ${firstName}, saw the ${params.jobTitle} role at ${params.companyName} — would love to learn more about the team. Open to connecting?`,
    };
  }
}
