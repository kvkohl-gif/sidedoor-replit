import { callClaude } from "./claude";

/**
 * Side Door Outreach Message Generation Service
 *
 * Implements the full email framework from AI_EMAIL_GENERATION_REFERENCE.md.
 *
 * Templates:
 *   A1 — Hiring Manager + Personal Story (origin story)
 *   A2 — Hiring Manager + Lived Experience
 *   B  — Recruiter (qualifications-led)
 *   C  — Prototype / Work-Product Play (highest-converting; requires portfolio)
 *   D  — Mutual Connection (highest single-metric converter)
 *   E  — 7-Day Follow-Up
 *   F  — Thank-You After Interview
 *   G  — Post-Rejection Grace Note
 *
 * Selection Logic:
 *   IF mutual_connection → D
 *   ELIF portfolio matches domain → C
 *   ELIF contact is recruiter/HR → B
 *   ELIF user has origin-story hook matching domain → A1
 *   ELIF user has lived-experience hook matching domain → A2
 *   ELSE → B (safe default)
 */

// ─── Types ──────────────────────────────────────────────────────────

export type EmailTemplateType =
  | "auto"
  | "A1_origin_story"
  | "A2_lived_experience"
  | "B_recruiter"
  | "C_prototype"
  | "D_mutual_connection"
  | "E_followup"
  | "F_thank_you"
  | "G_rejection_grace";

export interface PortfolioItem {
  url: string;
  description: string;
  domain_tags?: string[];
}

export interface MutualConnection {
  name: string;
  context: string; // e.g. "She thought there might be a strong fit"
  company?: string;
}

export interface MessageGenerationParams {
  // Contact
  recruiterName: string;
  recruiterTitle: string;
  recruiterEmail?: string | null;
  outreachBucket?: "recruiter" | "department_lead";

  // Job
  companyName: string;
  jobTitle: string;
  jobDescription: string;

  // User profile
  userFirstName?: string;
  userBio?: string;
  userResume?: string;
  userAchievements?: string[];
  userStoryHooks?: string[];
  userCareerGoals?: string;
  userHobbies?: string[];
  portfolioItems?: PortfolioItem[];
  mutualConnections?: MutualConnection[];

  // Voice
  voiceFormality?: number;
  voiceDirectness?: number;
  voiceLength?: number;
  voiceNotes?: string;

  // Template override (when user explicitly picks one)
  templateOverride?: EmailTemplateType;

  // Follow-up / thank-you / grace context
  originalSubject?: string;
  recentNews?: string;
  interviewTopic?: string;
  interviewDetail?: string;
  followUpThought?: string;
}

export interface GeneratedMessages {
  emailSubject: string;
  emailContent: string;
  linkedinContent: string;
  templateUsed: EmailTemplateType;
  qualityScore: number; // 0-12
  qualityWarnings: string[];
}

// ─── Anti-Pattern Detection ─────────────────────────────────────────

const BANNED_PHRASES = [
  "i hope this finds you well",
  "i'm writing to express my interest",
  "exciting opportunity",
  "passionate about",
  "i believe i would be a great fit",
  "i believe my skills",
  "thrilled",
  "eager",
  "to whom it may concern",
  "please find attached",
  "[your name]",
  "[first name]",
  "[company]",
  "[role]",
  "{{",
];

function containsBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Template Selection ─────────────────────────────────────────────

function selectTemplate(params: MessageGenerationParams): EmailTemplateType {
  if (params.templateOverride && params.templateOverride !== "auto") {
    return params.templateOverride;
  }

  const hasMutual = (params.mutualConnections?.length ?? 0) > 0;
  if (hasMutual) return "D_mutual_connection";

  const company = params.companyName.toLowerCase();
  const jobDesc = (params.jobDescription || "").toLowerCase();

  // Portfolio domain match
  const matchingPortfolio = params.portfolioItems?.find((item) => {
    if (!item.domain_tags?.length) return false;
    return item.domain_tags.some(
      (tag) => company.includes(tag.toLowerCase()) || jobDesc.includes(tag.toLowerCase())
    );
  });
  if (matchingPortfolio) return "C_prototype";

  // Recruiter detection — title or department keywords
  const title = (params.recruiterTitle || "").toLowerCase();
  const isRecruiter =
    params.outreachBucket === "recruiter" ||
    /recruit|talent|people\s*ops|human\s*resources|\bhr\b|sourcer/.test(title);
  if (isRecruiter) return "B_recruiter";

  // Story hook routing — origin story vs lived experience
  const hooks = params.userStoryHooks || [];
  const hasOriginHook = hooks.some((h) =>
    /grew up|raised|childhood|family|hometown|i was born/i.test(h)
  );
  const hasLivedHook = hooks.some((h) =>
    /devoted|user|investor|customer|i've used|i use|i'm a/i.test(h)
  );

  if (hasOriginHook) return "A1_origin_story";
  if (hasLivedHook) return "A2_lived_experience";

  // Default to recruiter format (safest, most efficient)
  return "B_recruiter";
}

// ─── Voice Helpers ──────────────────────────────────────────────────

function buildVoiceInstruction(params: MessageGenerationParams): string {
  return [
    (params.voiceFormality ?? 0.5) < 0.3
      ? "Use a casual, conversational tone — like texting a professional contact."
      : (params.voiceFormality ?? 0.5) > 0.7
      ? "Use a polished, professional tone — but still human, not corporate."
      : "",
    (params.voiceDirectness ?? 0.5) > 0.7
      ? "Be direct — get to the point in the first sentence."
      : (params.voiceDirectness ?? 0.5) < 0.3
      ? "Be warm — build rapport before any ask."
      : "",
    (params.voiceLength ?? 0.3) > 0.6
      ? "Write at full length with supporting detail (up to 150 words)."
      : (params.voiceLength ?? 0.3) < 0.2
      ? "Keep it extremely brief — under 90 words."
      : "Keep it concise — 90 to 130 words.",
    params.voiceNotes ? `Additional voice guidance: ${params.voiceNotes}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildProfileContext(params: MessageGenerationParams): string {
  const sections: string[] = [];

  if (params.userResume && params.userResume.trim().length > 50) {
    sections.push(`RESUME EXCERPT (use for specific experience details):\n${params.userResume.trim().slice(0, 1200)}`);
  }
  if (params.userBio) {
    sections.push(`PROFESSIONAL BIO:\n${params.userBio}`);
  }
  if (params.userAchievements?.length) {
    sections.push(
      `KEY ACHIEVEMENTS (pick the ONE most relevant to this role):\n${params.userAchievements
        .slice(0, 5)
        .map((a) => `- ${a}`)
        .join("\n")}`
    );
  }
  if (params.userStoryHooks?.length) {
    sections.push(
      `PERSONAL STORY HOOKS (weave ONE into the opening):\n${params.userStoryHooks
        .slice(0, 3)
        .map((h) => `- ${h}`)
        .join("\n")}`
    );
  }
  if (params.userHobbies?.length) {
    sections.push(
      `HOBBIES & INTERESTS (use ONLY if one connects to the company/role/contact):\n${params.userHobbies
        .slice(0, 4)
        .map((h) => `- ${h}`)
        .join("\n")}`
    );
  }
  if (params.userCareerGoals) {
    sections.push(`CAREER DIRECTION:\n${params.userCareerGoals}`);
  }
  if (params.portfolioItems?.length) {
    sections.push(
      `PORTFOLIO ITEMS (link if directly relevant):\n${params.portfolioItems
        .map((p) => `- ${p.description} → ${p.url}`)
        .join("\n")}`
    );
  }

  return sections.join("\n\n");
}

// ─── System Prompts (one per template) ──────────────────────────────

const SYS_RECRUITER = `You write cold outreach from job seekers TO recruiters. Your emails get replies because they feel like a real human wrote them — not a template.

CORE PRINCIPLES:
1. PERSONAL CONNECTION OR SHARP COMPANY OBSERVATION in the first sentence. Never generic openers.
2. ONE PROOF POINT — pick the single most relevant achievement, tie it to a JD requirement.
3. BRIDGE — explicitly connect background to what the role needs.
4. EASY-OUT CTA — "If you're the right person for this, I'd love a quick chat — or happy to be pointed in the right direction."

BANNED PHRASES (never use): "I hope this finds you well", "I'm writing to express my interest", "exciting opportunity", "passionate about", "I believe I would be a great fit", "thrilled", "eager", "to whom it may concern".

SUBJECT LINE: Under 50 characters. Reference the company + a specific hook. Not "Application for..." or "Interested in...".

OUTPUT FORMAT: JSON with keys emailSubject, emailContent, linkedinContent. Sign the email with the user's actual first name (provided in context). Never use "[Your Name]".`;

const SYS_HIRING_MANAGER = `You write cold outreach from job seekers TO hiring managers and department leads. Tone is peer-to-peer, not supplicant. They respect domain expertise over enthusiasm.

CORE PRINCIPLES:
1. OBSERVE — open with a specific observation about the company, team, or domain. If a personal story hook connects, use it.
2. DEMONSTRATE DOMAIN EXPERTISE — one concrete project/metric proving competence.
3. ALIGN — connect career trajectory to what the team is building. Mutual fit, not "I need a job".
4. PEER-LEVEL INVITE — conversation starter, not a job ask.

BANNED PHRASES (never use): "I hope this finds you well", "passionate about", "thrilled", "eager", "exciting opportunity", "I believe I would be a great fit".

SUBJECT LINE: Under 50 characters. Reference their domain or team, not just the role title.

OUTPUT FORMAT: JSON with keys emailSubject, emailContent, linkedinContent. Sign the email with the user's actual first name (provided in context). Never use "[Your Name]".`;

const SYS_PROTOTYPE = `You write cold outreach from job seekers who have built something directly relevant to the target company. The work-product is the lead — show, don't tell.

CORE PRINCIPLES:
1. Open with the prototype/project — what it is, in one sentence.
2. Connect it to what the company is doing — show you understand their space.
3. Offer to walk them through it OR a specific time-bound chat.
4. Keep it short — the link does the heavy lifting.

OUTPUT FORMAT: JSON with keys emailSubject, emailContent, linkedinContent. Sign with the user's first name. Never use placeholders.`;

const SYS_MUTUAL = `You write warm-introduction emails where the sender has a mutual connection to the recipient. The mutual contact is the entire trust mechanism — lead with them.

CORE PRINCIPLES:
1. First sentence: "[Mutual name] suggested I reach out — [mutual context]."
2. Briefly state what makes the sender a fit.
3. One clear, time-bound ask.
4. Stay under 100 words.

OUTPUT FORMAT: JSON with keys emailSubject, emailContent, linkedinContent. Sign with the user's first name. Never use placeholders.`;

const SYS_FOLLOWUP = `You write 7-day follow-up emails to non-responders. The original email already pitched fit — the follow-up adds new information or stays brief.

CORE PRINCIPLES:
1. Subject: "Re: [original subject]"
2. First line: "Bumping this up in case it got buried."
3. If recent news exists, add ONE sentence: "Since I wrote, I saw [Company] announced [thing] — made me even more excited about [angle]."
4. If no news, restate fit in ONE sentence — never re-send the original.
5. Hard cap: 50 words of body text.

OUTPUT FORMAT: JSON with keys emailSubject, emailContent, linkedinContent. Sign with the user's first name.`;

const SYS_THANK_YOU = `You write thank-you emails sent within 4 hours of an interview. They reinforce fit and surface ONE thoughtful follow-up idea.

CORE PRINCIPLES:
1. Reference a specific topic from the conversation.
2. Add ONE substantive thought — a continuation of an interview discussion, an observation, or an offer to share something.
3. Close with confidence about next steps.
4. 80-120 words.

OUTPUT FORMAT: JSON with keys emailSubject, emailContent, linkedinContent. Sign with the user's first name.`;

const SYS_REJECTION_GRACE = `You write post-rejection grace notes that keep the door open for future roles or referrals.

CORE PRINCIPLES:
1. Thank them for their time and the team's consideration.
2. Briefly ask for any feedback they can share.
3. Express genuine interest in future openings at the company.
4. Stay under 80 words. Never bitter, never desperate.

OUTPUT FORMAT: JSON with keys emailSubject, emailContent, linkedinContent. Sign with the user's first name.`;

// ─── Prompt Builders ────────────────────────────────────────────────

function commonContext(params: MessageGenerationParams): string {
  return `USER FIRST NAME (use this as the email signature): ${params.userFirstName || "[user has not set their first name]"}

TARGET CONTACT:
- Name: ${params.recruiterName}
- Title: ${params.recruiterTitle}
- Company: ${params.companyName}
- Role being discussed: ${params.jobTitle}

JOB DESCRIPTION (excerpt):
${(params.jobDescription || "No JD available.").slice(0, 1500)}`;
}

function buildPrompt(template: EmailTemplateType, params: MessageGenerationParams): { system: string; user: string } {
  const profile = buildProfileContext(params);
  const voice = buildVoiceInstruction(params);
  const ctx = commonContext(params);
  const firstName = (params.recruiterName || "").split(" ")[0] || "there";

  switch (template) {
    case "D_mutual_connection": {
      const mutual = params.mutualConnections?.[0];
      return {
        system: SYS_MUTUAL,
        user: `${ctx}

MUTUAL CONNECTION:
- Name: ${mutual?.name || "[missing]"}
- Context: ${mutual?.context || "[missing]"}

${profile ? `SENDER'S PROFILE:\n${profile}` : ""}

${voice ? `VOICE: ${voice}` : ""}

Greeting: "Hi ${firstName},"
Body: 80-110 words.
Subject: under 50 chars, format like "${mutual?.name?.split(" ")[0] || "[mutual]"} suggested I reach out about ${params.jobTitle}".

Return JSON: { "emailSubject": "...", "emailContent": "...", "linkedinContent": "..." }`,
      };
    }

    case "C_prototype": {
      const portfolio = params.portfolioItems?.[0];
      return {
        system: SYS_PROTOTYPE,
        user: `${ctx}

PORTFOLIO ITEM (lead with this):
- Description: ${portfolio?.description || "[missing]"}
- Link: ${portfolio?.url || "[missing]"}

${profile ? `SENDER'S PROFILE:\n${profile}` : ""}

${voice ? `VOICE: ${voice}` : ""}

Greeting: "Hi ${firstName},"
Body: 90-130 words.
Subject: under 50 chars, format like "Built something relevant to ${params.companyName}".

Return JSON: { "emailSubject": "...", "emailContent": "...", "linkedinContent": "..." }`,
      };
    }

    case "B_recruiter": {
      return {
        system: SYS_RECRUITER,
        user: `${ctx}

${profile ? `SENDER'S PROFILE:\n${profile}` : "(No profile — write a strong company-specific message using the JD only.)"}

${voice ? `VOICE: ${voice}` : ""}

EMAIL STRUCTURE — Connect → Prove → Bridge → Easy Ask:
1. Connect (1-2 sentences): personal hook to company/product, OR a specific JD reference.
2. Prove (1-2 sentences): one most-relevant achievement with metric/specific.
3. Bridge (1 sentence): explicit tie to a JD requirement.
4. Easy Ask (1 sentence): low-pressure with the easy-out language.

Greeting: "Hi ${firstName},"
Sign-off: "Best,\\n${params.userFirstName || "[your name]"}"
Body: 80-130 words.
Subject: under 50 chars referencing ${params.companyName} + a specific hook.

LinkedIn DM: under 300 chars, conversational, ends with a question. NOT a copy of the email.

Return JSON: { "emailSubject": "...", "emailContent": "...", "linkedinContent": "..." }`,
      };
    }

    case "A1_origin_story":
    case "A2_lived_experience": {
      const variantNote =
        template === "A1_origin_story"
          ? "Use the origin-story hook (childhood, family, where you grew up)."
          : "Use the lived-experience hook (you're a customer, user, or have personally faced the pain).";
      return {
        system: SYS_HIRING_MANAGER,
        user: `${ctx}

${profile ? `SENDER'S PROFILE:\n${profile}` : ""}

${voice ? `VOICE: ${voice}` : ""}

VARIANT INSTRUCTION: ${variantNote}

EMAIL STRUCTURE — Observe → Demonstrate → Align → Invite:
1. Observe (1-2 sentences): personal story hook + connection to company mission.
2. Demonstrate (1-2 sentences): ONE concrete proof point with a metric or specific outcome.
3. Align (1 sentence): mutual fit framing.
4. Invite (1 sentence): peer-level conversation starter with a specific timeframe.

Greeting: "Hi ${firstName},"
Sign-off: "${params.userFirstName || "[your name]"}"
Body: 90-140 words.
Subject: under 50 chars, references shared context (e.g. "Small farm kid → product person who gets ag-tech").

LinkedIn DM: under 300 chars, peer-tone, distinct from the email.

Return JSON: { "emailSubject": "...", "emailContent": "...", "linkedinContent": "..." }`,
      };
    }

    case "E_followup": {
      return {
        system: SYS_FOLLOWUP,
        user: `${ctx}

ORIGINAL SUBJECT: ${params.originalSubject || `${params.jobTitle} at ${params.companyName}`}
${params.recentNews ? `RECENT NEWS: ${params.recentNews}` : "(No recent news — keep follow-up brief and restated.)"}

Greeting: "Hi ${firstName},"
Body: under 50 words. First line "Bumping this up in case it got buried."
Subject: "Re: ${params.originalSubject || params.jobTitle}"

Return JSON: { "emailSubject": "...", "emailContent": "...", "linkedinContent": "" }`,
      };
    }

    case "F_thank_you": {
      return {
        system: SYS_THANK_YOU,
        user: `${ctx}

INTERVIEW CONTEXT:
- Topic discussed: ${params.interviewTopic || "the role and team"}
- Specific detail: ${params.interviewDetail || "[user did not provide]"}
- Follow-up thought: ${params.followUpThought || "[user did not provide — generate one substantive idea based on the JD]"}

${profile ? `SENDER'S PROFILE:\n${profile}` : ""}

Greeting: "Hi ${firstName},"
Body: 80-120 words.
Subject: "Thank you — ${params.jobTitle} conversation"

Return JSON: { "emailSubject": "...", "emailContent": "...", "linkedinContent": "" }`,
      };
    }

    case "G_rejection_grace": {
      return {
        system: SYS_REJECTION_GRACE,
        user: `${ctx}

ORIGINAL SUBJECT: ${params.originalSubject || `${params.jobTitle} at ${params.companyName}`}

Greeting: "Hi ${firstName},"
Body: under 80 words. Thank them, ask for feedback, express interest in future openings.
Subject: "Re: ${params.originalSubject || params.jobTitle}"

Return JSON: { "emailSubject": "...", "emailContent": "...", "linkedinContent": "" }`,
      };
    }

    default:
      throw new Error(`Unknown template: ${template}`);
  }
}

// ─── Quality Scoring (Section 7) ────────────────────────────────────

function scoreEmail(content: string, subject: string, params: MessageGenerationParams): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0;

  const wordCount = countWords(content);
  const lower = content.toLowerCase();
  const company = params.companyName.toLowerCase();

  // Personalization (0-2)
  const hasCompanyMention = lower.includes(company);
  const hasStoryHook = (params.userStoryHooks || []).some((h) =>
    lower.includes(h.toLowerCase().slice(0, 20))
  );
  if (hasStoryHook || (hasCompanyMention && /\b(your|their)\s+\w+\b/.test(lower))) score += 2;
  else if (hasCompanyMention) score += 1;
  else warnings.push("No company-specific personalization detected");

  // Relevance (0-2)
  const hasMetric = /\b\d+(?:\.\d+)?\s*(?:%|x|years?|months?|m\b|k\b|\+)/i.test(content);
  if (hasMetric) score += 2;
  else if (lower.includes("led") || lower.includes("built") || lower.includes("launched")) score += 1;
  else warnings.push("No concrete achievement or metric");

  // Brevity (0-2)
  if (wordCount >= 80 && wordCount <= 130) score += 2;
  else if (wordCount >= 60 && wordCount <= 150) score += 1;
  else warnings.push(`Word count ${wordCount} outside target 80-130`);

  // Ask clarity (0-2)
  if (/\b(this week|tomorrow|thursday|friday|monday|tuesday|wednesday|next week|15 minutes|20 minutes)\b/i.test(content)) score += 2;
  else if (/\b(chat|call|connect|coffee|meeting)\b/i.test(content)) score += 1;
  else warnings.push("No clear ask detected");

  // Tone (0-2)
  const banned = containsBannedPhrases(content);
  if (banned.length === 0) score += 2;
  else {
    warnings.push(`Banned phrase(s) detected: ${banned.join(", ")}`);
    score += 0;
  }

  // First sentence (0-2)
  const firstSentence = content.split(/[.!?]\s/)[0] || "";
  const firstLower = firstSentence.toLowerCase();
  if (firstLower.includes(company) || hasStoryHook) score += 2;
  else if (firstSentence.length > 20 && !firstLower.includes("i'm writing") && !firstLower.includes("hi ")) score += 1;
  else warnings.push("First sentence is generic");

  // Subject check
  if (subject.length > 50) warnings.push(`Subject too long (${subject.length} chars)`);
  if (!subject.toLowerCase().includes(company) && !subject.toLowerCase().includes(params.jobTitle.toLowerCase().split(" ")[0])) {
    warnings.push("Subject missing company/role reference");
  }

  // Placeholder check
  if (/\[your name\]|\[first name\]|\{\{/i.test(content)) {
    warnings.push("UNFILLED PLACEHOLDER detected");
    score = Math.max(0, score - 4);
  }

  return { score, warnings };
}

// ─── Main Entry Point ───────────────────────────────────────────────

export async function generatePersonalizedMessages(params: MessageGenerationParams): Promise<GeneratedMessages> {
  const template = selectTemplate(params);
  const { system, user } = buildPrompt(template, params);
  const firstName = (params.recruiterName || "").split(" ")[0] || "there";
  const userFirstName = params.userFirstName || "Best";

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const raw = await callClaude({
        system,
        user,
        jsonMode: true,
        temperature: 0.7,
        maxTokens: 1500,
      });

      const result = JSON.parse(raw);

      let emailContent = String(result.emailContent || "");
      let linkedinContent = String(result.linkedinContent || "");
      let emailSubject = String(result.emailSubject || "");

      // Replace any leaked placeholders with the real first name
      emailContent = emailContent
        .replace(/\[your name\]/gi, userFirstName)
        .replace(/\[first name\]/gi, userFirstName)
        .replace(/\{\{user_first\}\}/gi, userFirstName);

      // Truncate
      if (linkedinContent.length > 300) linkedinContent = linkedinContent.slice(0, 297) + "...";
      if (emailSubject.length > 60) emailSubject = emailSubject.slice(0, 57) + "...";

      // Quality score
      const { score, warnings } = scoreEmail(emailContent, emailSubject, params);

      // Retry once if banned phrases or critical issues found
      const hasCritical =
        warnings.some((w) => w.includes("Banned phrase") || w.includes("UNFILLED PLACEHOLDER"));
      if (hasCritical && attempt < maxAttempts) {
        continue;
      }

      return {
        emailSubject: emailSubject || `${params.jobTitle.slice(0, 30)} at ${params.companyName}`.slice(0, 60),
        emailContent: emailContent || `Hi ${firstName},\n\nI wanted to reach out about the ${params.jobTitle} role at ${params.companyName}.\n\n${userFirstName}`,
        linkedinContent: linkedinContent || `Hi ${firstName}, interested in the ${params.jobTitle} role at ${params.companyName}. Open to connecting?`,
        templateUsed: template,
        qualityScore: score,
        qualityWarnings: warnings,
      };
    } catch (error) {
      console.error(`[generatePersonalizedMessages attempt ${attempt}]`, error);
      if (attempt >= maxAttempts) {
        const fallbackSubject = `${params.jobTitle} at ${params.companyName}`.slice(0, 60);
        const fallbackBody = `Hi ${firstName},\n\nI came across the ${params.jobTitle} role at ${params.companyName} and wanted to reach out. I'd love to learn more about how my background could be a fit. If you're the right person for this, I'd be grateful for a quick chat — or happy to be pointed in the right direction.\n\n${userFirstName}`;
        return {
          emailSubject: fallbackSubject,
          emailContent: fallbackBody,
          linkedinContent: `Hi ${firstName}, saw the ${params.jobTitle} role at ${params.companyName} — would love to connect.`.slice(0, 297),
          templateUsed: template,
          qualityScore: 0,
          qualityWarnings: ["Generation failed — returning fallback"],
        };
      }
    }
  }

  // Should not reach here
  throw new Error("Generation loop exited unexpectedly");
}
