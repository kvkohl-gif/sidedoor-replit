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
}
