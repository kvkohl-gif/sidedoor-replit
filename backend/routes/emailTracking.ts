import { Router, Request, Response } from "express";
import { logEmailEvent, isEmailConfigured, sendEmail, generateTrackingId } from "../services/emailService";
import { supabaseAdmin } from "../lib/supabaseClient";
import { logActivity } from "../services/outreachActivityService";

const router = Router();

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Track email open (no auth - called from email client)
router.get("/track/open/:trackingId", async (req: Request, res: Response) => {
  try {
    await logEmailEvent(req.params.trackingId, "opened", {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
  } catch (e) {
    // Don't fail the pixel response
  }
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": TRANSPARENT_GIF.length,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  });
  res.end(TRANSPARENT_GIF);
});

// Track click (no auth - redirect to original URL)
router.get("/track/click/:trackingId", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  try {
    await logEmailEvent(req.params.trackingId, "clicked", { url });
  } catch (e) {
    // Don't fail the redirect
  }
  res.redirect(url || "/");
});

// Provider webhook (SendGrid/Resend event notifications)
router.post("/webhooks/email", async (req: Request, res: Response) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    for (const event of events) {
      // SendGrid format
      if (event.event && event.tracking_id) {
        const typeMap: Record<string, string> = {
          delivered: "delivered",
          open: "opened",
          click: "clicked",
          bounce: "bounced",
          dropped: "bounced",
          spamreport: "bounced",
        };
        const eventType = typeMap[event.event];
        if (eventType) {
          await logEmailEvent(event.tracking_id, eventType, event);
        }
      }
      // Resend format
      if (event.type && event.data?.headers?.["X-Tracking-Id"]) {
        const trackingId = event.data.headers["X-Tracking-Id"];
        const typeMap: Record<string, string> = {
          "email.delivered": "delivered",
          "email.opened": "opened",
          "email.clicked": "clicked",
          "email.bounced": "bounced",
          "email.complained": "bounced",
        };
        const eventType = typeMap[event.type];
        if (eventType) {
          await logEmailEvent(trackingId, eventType, event.data);
        }
      }
    }
    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Email event error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Send email for a contact (authenticated)
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

router.post("/outreach/send-email", requireAuth, async (req: Request, res: Response) => {
  if (!isEmailConfigured()) {
    return res.status(503).json({ error: "Email sending is not configured. Contact support to enable." });
  }

  const userId = req.user!.id;
  const { contactId, subject, html } = req.body;

  if (!contactId || !subject || !html) {
    return res.status(400).json({ error: "contactId, subject, and html are required" });
  }

  // Verify ownership
  const { data: contact } = await supabaseAdmin
    .from("recruiter_contacts")
    .select("id, email, name, job_submission_id")
    .eq("id", contactId)
    .single();

  if (!contact || !contact.email) {
    return res.status(404).json({ error: "Contact not found or has no email" });
  }

  // Verify the contact belongs to this user via job_submission
  const { data: sub } = await supabaseAdmin
    .from("job_submissions")
    .select("user_id")
    .eq("id", contact.job_submission_id)
    .eq("user_id", userId)
    .single();

  if (!sub) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const trackingId = generateTrackingId();
  const result = await sendEmail({
    to: contact.email,
    subject,
    html,
    userId,
    contactId: parseInt(contactId),
    trackingId,
  });

  if (!result.success) {
    return res.status(500).json({ error: result.error });
  }

  // Update contact status
  await supabaseAdmin
    .from("recruiter_contacts")
    .update({
      contact_status: "email_sent",
      last_contacted_at: new Date().toISOString(),
      email_subject: subject,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  // Log outreach activity
  await logActivity({
    userId,
    contactId: parseInt(contactId),
    submissionId: contact.job_submission_id,
    activityType: "email_sent",
    channel: "email",
    messageContent: html,
    notes: `Sent: ${subject}`,
  });

  return res.json({ success: true, messageId: result.messageId, trackingId });
});

export function registerEmailTrackingRoutes(app: any) {
  app.use("/api", router);
}
