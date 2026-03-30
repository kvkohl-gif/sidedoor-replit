import { Application, Request, Response } from "express";
import { requireAuth } from "../middleware/sessionAuth";
import {
  getPipelineCounts,
  getFollowUpsDue,
  getContactTimeline,
  logActivity,
} from "../services/outreachActivityService";
import {
  getOnboardingState,
  markChecklistItem,
} from "../services/onboardingService";
import { supabaseAdmin } from "../lib/supabaseClient";

export function registerOutreachRoutes(app: Application) {
  // Get pipeline stage counts
  app.get("/api/outreach/pipeline", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const pipeline = await getPipelineCounts(userId);
      res.json(pipeline);
    } catch (error: any) {
      console.error("Error fetching pipeline counts:", error);
      res.status(500).json({ error: error.message || "Failed to fetch pipeline counts" });
    }
  });

  // Get contacts needing follow-up
  app.get("/api/outreach/follow-ups", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const contacts = await getFollowUpsDue(userId);
      res.json({ contacts });
    } catch (error: any) {
      console.error("Error fetching follow-ups:", error);
      res.status(500).json({ error: error.message || "Failed to fetch follow-ups" });
    }
  });

  // Get activity timeline for a contact
  app.get("/api/outreach/contacts/:id/timeline", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const contactId = req.params.id;

      const contactIdNum = parseInt(contactId);
      if (isNaN(contactIdNum)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      // Verify user owns this contact through job_submissions
      const { data: contact, error: ownershipError } = await supabaseAdmin
        .from("recruiter_contacts")
        .select("id, job_submission_id, job_submissions!inner(user_id)")
        .eq("id", contactIdNum)
        .eq("job_submissions.user_id", userId)
        .single();

      if (ownershipError || !contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      const activities = await getContactTimeline(contactIdNum);
      res.json({ activities });
    } catch (error: any) {
      console.error("Error fetching contact timeline:", error);
      res.status(500).json({ error: error.message || "Failed to fetch contact timeline" });
    }
  });

  // Log an outreach activity
  app.post("/api/outreach/activities", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { contactId, activityType, channel, messageContent, notes } = req.body;

      if (!contactId || !activityType) {
        return res.status(400).json({ error: "contactId and activityType are required" });
      }

      const contactIdNum = typeof contactId === 'string' ? parseInt(contactId) : contactId;
      if (isNaN(contactIdNum)) {
        return res.status(400).json({ error: "Invalid contact ID" });
      }

      // Look up the contact to get job_submission_id and verify ownership
      const { data: contact, error: contactError } = await supabaseAdmin
        .from("recruiter_contacts")
        .select("id, job_submission_id, job_submissions!inner(user_id)")
        .eq("id", contactIdNum)
        .eq("job_submissions.user_id", userId)
        .single();

      if (contactError || !contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      const activity = await logActivity({
        userId,
        contactId: contactIdNum,
        submissionId: contact.job_submission_id,
        activityType,
        channel,
        messageContent,
        notes,
      });

      res.json({ activity });
    } catch (error: any) {
      console.error("Error logging outreach activity:", error);
      res.status(500).json({ error: error.message || "Failed to log outreach activity" });
    }
  });

  // Get onboarding state
  app.get("/api/onboarding", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const state = await getOnboardingState(userId);
      res.json(state);
    } catch (error: any) {
      console.error("Error fetching onboarding state:", error);
      res.status(500).json({ error: error.message || "Failed to fetch onboarding state" });
    }
  });

  // Mark a checklist item as complete
  app.patch("/api/onboarding/checklist", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { item } = req.body;

      if (!item) {
        return res.status(400).json({ error: "item is required" });
      }

      const state = await markChecklistItem(userId, item);
      res.json(state);
    } catch (error: any) {
      console.error("Error marking checklist item:", error);
      res.status(500).json({ error: error.message || "Failed to mark checklist item" });
    }
  });

  // Get outreach metrics with period comparison
  app.get("/api/outreach/metrics", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const period = (req.query.period as string) || "7d";

      const periodDays: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90, all: 9999 };
      const days = periodDays[period] || 7;

      const now = new Date();
      const periodStart = new Date(now.getTime() - days * 86400000);
      const prevPeriodStart = new Date(periodStart.getTime() - days * 86400000);

      // Get all user's contacts via job_submissions
      const { data: allContacts = [] } = await supabaseAdmin
        .from("recruiter_contacts")
        .select("id, contact_status, generated_email_message, last_contacted_at, created_at, name, email, email_subject, title, job_submissions!inner(company_name, user_id)")
        .eq("job_submissions.user_id", userId);

      const sentStatuses = new Set(["email_sent", "linkedin_sent", "awaiting_reply", "follow_up_needed", "replied", "interview_scheduled"]);

      // Current period metrics
      const inPeriod = days >= 9999 ? allContacts : allContacts.filter((c: any) => new Date(c.created_at) >= periodStart);
      const drafted = inPeriod.filter((c: any) => c.generated_email_message).length;
      const sent = inPeriod.filter((c: any) => sentStatuses.has(c.contact_status)).length;
      const replied = inPeriod.filter((c: any) => c.contact_status === "replied").length;

      // Previous period for delta
      const inPrevPeriod = allContacts.filter((c: any) => {
        const d = new Date(c.created_at);
        return d >= prevPeriodStart && d < periodStart;
      });
      const prevDrafted = inPrevPeriod.filter((c: any) => c.generated_email_message).length;
      const prevSent = inPrevPeriod.filter((c: any) => sentStatuses.has(c.contact_status)).length;
      const prevReplied = inPrevPeriod.filter((c: any) => c.contact_status === "replied").length;

      // Opened count from email_events
      const { count: openedCount } = await supabaseAdmin
        .from("email_events")
        .select("recruiter_contact_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "opened");
      const opened = openedCount || 0;

      const { count: prevOpenedCount } = await supabaseAdmin
        .from("email_events")
        .select("recruiter_contact_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "opened")
        .lt("created_at", periodStart.toISOString());
      const prevOpened = prevOpenedCount || 0;

      // Recent replies
      const recentReplies = allContacts
        .filter((c: any) => c.contact_status === "replied")
        .sort((a: any, b: any) => new Date(b.last_contacted_at || b.created_at).getTime() - new Date(a.last_contacted_at || a.created_at).getTime())
        .slice(0, 10)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          emailSubject: c.email_subject || "No subject",
          companyName: c.job_submissions?.company_name || "",
          lastContactedAt: c.last_contacted_at || c.created_at,
        }));

      return res.json({
        drafted, sent, opened, replied,
        draftedDelta: drafted - prevDrafted,
        sentDelta: sent - prevSent,
        openedDelta: opened - prevOpened,
        repliedDelta: replied - prevReplied,
        recentReplies,
      });
    } catch (error) {
      console.error("Metrics error:", error);
      return res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // Get outreach contacts (contacted contacts with filtering)
  app.get("/api/outreach/contacts", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { search, status, company, tags, dateFrom, dateTo, sort, limit: limitStr } = req.query;
      const limit = parseInt(limitStr as string) || 50;

      let query = supabaseAdmin
        .from("recruiter_contacts")
        .select("*, job_submissions!inner(company_name, job_title, user_id)")
        .eq("job_submissions.user_id", userId)
        .neq("contact_status", "not_contacted")
        .order("last_contacted_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (status) {
        query = query.in("contact_status", (status as string).split(","));
      }
      if (tags) {
        query = query.contains("tags", (tags as string).split(","));
      }
      if (dateFrom) {
        query = query.gte("last_contacted_at", dateFrom as string);
      }
      if (dateTo) {
        query = query.lte("last_contacted_at", dateTo as string);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by company name (can't do in Supabase query on joined field easily)
      let results = data || [];
      if (company) {
        results = results.filter((c: any) => c.job_submissions?.company_name === company);
      }

      const mapped = results.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        title: c.title,
        contactStatus: c.contact_status,
        emailSubject: c.email_subject,
        lastContactedAt: c.last_contacted_at,
        createdAt: c.created_at,
        tags: c.tags || [],
        companyName: c.job_submissions?.company_name || "",
        jobTitle: c.job_submissions?.job_title || "",
        followUpCount: c.follow_up_count || 0,
      }));

      return res.json(mapped);
    } catch (error) {
      console.error("Outreach contacts error:", error);
      return res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  // Get distinct company names for filtering
  app.get("/api/outreach/companies", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { data } = await supabaseAdmin
        .from("job_submissions")
        .select("company_name")
        .eq("user_id", userId)
        .not("company_name", "is", null);

      const companies = [...new Set((data || []).map((d: any) => d.company_name).filter(Boolean))].sort();
      return res.json(companies);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch companies" });
    }
  });
}
