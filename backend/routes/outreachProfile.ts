import type { Express, Request, Response } from "express";
import { supabaseAdmin as supabase } from "../lib/supabaseClient";
import { callClaude } from "../claude";

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function computeCompleteness(profile: any): number {
  let score = 0;
  if (profile.resume_text && profile.resume_text.trim().length > 50) score += 25;
  if (profile.bio && profile.bio.trim().length > 20) score += 20;
  const achievements = safeParseArray(profile.achievements);
  if (achievements.length >= 2) score += 20;
  if (profile.career_goals && profile.career_goals.trim().length > 10) score += 15;
  if (profile.voice_formality !== 0.5 || profile.voice_directness !== 0.5 || profile.voice_length !== 0.3 ||
      (profile.voice_notes && profile.voice_notes.trim().length > 0)) score += 10;
  const hooks = safeParseArray(profile.story_hooks);
  if (hooks.length >= 1) score += 10;
  return Math.min(score, 100);
}

function safeParseArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

export function registerOutreachProfileRoutes(app: Express) {
  app.get("/api/outreach-profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { data, error } = await supabase
        .from("user_outreach_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code === "PGRST116") {
        return res.json({
          resumeText: "",
          resumeFilename: "",
          bio: "",
          coverLetter: "",
          careerGoals: "",
          achievements: [],
          hobbies: [],
          storyHooks: [],
          voiceFormality: 0.5,
          voiceDirectness: 0.5,
          voiceLength: 0.3,
          voiceNotes: "",
          targetRoles: [],
          targetIndustries: [],
          targetCompanyStage: [],
          portfolioItems: [],
          mutualConnections: [],
          profileCompleteness: 0,
        });
      }
      if (error) throw error;

      res.json({
        resumeText: data.resume_text || "",
        resumeFilename: data.resume_filename || "",
        bio: data.bio || "",
        coverLetter: data.cover_letter || "",
        careerGoals: data.career_goals || "",
        achievements: safeParseArray(data.achievements),
        hobbies: safeParseArray(data.hobbies),
        storyHooks: safeParseArray(data.story_hooks),
        voiceFormality: data.voice_formality ?? 0.5,
        voiceDirectness: data.voice_directness ?? 0.5,
        voiceLength: data.voice_length ?? 0.3,
        voiceNotes: data.voice_notes || "",
        targetRoles: safeParseArray(data.target_roles),
        targetIndustries: safeParseArray(data.target_industries),
        targetCompanyStage: safeParseArray(data.target_company_stage),
        portfolioItems: safeParseArray(data.portfolio_items),
        mutualConnections: safeParseArray(data.mutual_connections),
        profileCompleteness: data.profile_completeness ?? 0,
      });
    } catch (err: any) {
      console.error("Error fetching outreach profile:", err);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.put("/api/outreach-profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const body = req.body;

      const profileData: any = {
        user_id: userId,
        resume_text: body.resumeText ?? null,
        resume_filename: body.resumeFilename ?? null,
        bio: body.bio ?? null,
        cover_letter: body.coverLetter ?? null,
        career_goals: body.careerGoals ?? null,
        achievements: JSON.stringify(body.achievements || []),
        hobbies: JSON.stringify(body.hobbies || []),
        story_hooks: JSON.stringify(body.storyHooks || []),
        voice_formality: body.voiceFormality ?? 0.5,
        voice_directness: body.voiceDirectness ?? 0.5,
        voice_length: body.voiceLength ?? 0.3,
        voice_notes: body.voiceNotes ?? null,
        target_roles: JSON.stringify(body.targetRoles || []),
        target_industries: JSON.stringify(body.targetIndustries || []),
        target_company_stage: JSON.stringify(body.targetCompanyStage || []),
        portfolio_items: JSON.stringify(body.portfolioItems || []),
        mutual_connections: JSON.stringify(body.mutualConnections || []),
        updated_at: new Date().toISOString(),
      };

      profileData.profile_completeness = computeCompleteness(profileData);

      const { data: existing } = await supabase
        .from("user_outreach_profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      let result;
      if (existing) {
        const { data, error } = await supabase
          .from("user_outreach_profiles")
          .update(profileData)
          .eq("user_id", userId)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("user_outreach_profiles")
          .insert(profileData)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      res.json({
        success: true,
        profileCompleteness: result.profile_completeness,
      });
    } catch (err: any) {
      console.error("Error saving outreach profile:", err);
      res.status(500).json({ error: "Failed to save profile" });
    }
  });

  app.post("/api/outreach-profile/ai-suggest", requireAuth, async (req: Request, res: Response) => {
    try {
      const { section, context } = req.body;

      if (!section || !context) {
        return res.status(400).json({ error: "Missing section or context" });
      }

      const resumeText = context.resumeText || "";
      if (!resumeText.trim()) {
        return res.status(400).json({ error: "No resume text provided. Upload or paste your resume first." });
      }

      let systemPrompt = "";
      let userPrompt = "";

      if (section === "bio") {
        systemPrompt = "You are helping a job seeker build their outreach profile for personalized cold emails to recruiters and hiring managers.";
        userPrompt = `Based on their resume, suggest a professional bio that:
- Tells a career narrative, not just lists jobs
- Highlights what makes them unique
- Is 2-3 sentences max
- Sounds human, not corporate

Resume:
${resumeText}

${context.existingBio ? `Current bio (improve upon this): ${context.existingBio}` : ""}`;
      } else if (section === "achievements") {
        systemPrompt = "You are helping a job seeker identify their most impressive quantifiable achievements from their resume.";
        userPrompt = `Extract 3-5 quantifiable wins from this resume. Each should include a specific metric (%, $, time, team size). Format as short bullet points. Return ONLY a JSON array of strings.

Resume:
${resumeText}

${context.existingAchievements?.length ? `Existing achievements (suggest different ones): ${JSON.stringify(context.existingAchievements)}` : ""}`;
      } else if (section === "story_hooks") {
        systemPrompt = "You are helping a job seeker identify unique personal story hooks that create instant rapport with recruiters.";
        userPrompt = `Based on this resume and bio, suggest 3 personal story hooks — unique facts, experiences, or connections that could create rapport. Focus on industry-specific connections, unique background elements, or unusual career pivots. Return ONLY a JSON array of strings.

Resume:
${resumeText}

${context.existingBio ? `Bio: ${context.existingBio}` : ""}`;
      } else if (section === "analyze_resume") {
        systemPrompt = "You are helping a job seeker build their outreach profile. Analyze their resume comprehensively.";
        userPrompt = `Analyze this resume and provide suggestions for three profile sections. Return a JSON object with these keys:
- "bio": A 2-3 sentence professional bio (string)
- "achievements": 3-5 quantifiable wins as short bullet points (array of strings)
- "storyHooks": 2-3 personal story hooks for recruiter rapport (array of strings)

Resume:
${resumeText}`;
      } else {
        return res.status(400).json({ error: "Invalid section" });
      }

      const raw = await callClaude({
        system: systemPrompt,
        user: userPrompt,
        jsonMode: section !== "bio", // bio returns prose, others return JSON
        temperature: 0.7,
        maxTokens: 1000,
      });

      if (section === "bio") {
        res.json({ suggestion: raw });
      } else if (section === "achievements" || section === "story_hooks") {
        try {
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const arr = JSON.parse(cleaned);
          res.json({ suggestion: arr });
        } catch {
          res.json({ suggestion: raw.split("\n").filter((l: string) => l.trim()).map((l: string) => l.replace(/^[-•*]\s*/, "").trim()) });
        }
      } else if (section === "analyze_resume") {
        try {
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          res.json({ suggestion: parsed });
        } catch {
          res.json({ suggestion: { bio: raw, achievements: [], storyHooks: [] } });
        }
      }
    } catch (err: any) {
      console.error("Error generating AI suggestion:", err);
      res.status(500).json({ error: "Failed to generate suggestion" });
    }
  });
}
