import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { logEmailEvent, isEmailConfigured, sendEmail, generateTrackingId } from "../services/emailService";
import { supabaseAdmin } from "../lib/supabaseClient";
import { logActivity } from "../services/outreachActivityService";
import { enforceDailySendCap, recipientDomainAllowed } from "../middleware/sendQuota";

const router = Router();

// ─── Provider webhook (SendGrid/Resend event notifications) ──────────
// SECURITY (audit C3): the previous handler accepted any unauthenticated POST
// and let attackers forge "delivered/opened/clicked/bounced" events for any
// tracking ID. This handler verifies an HMAC-SHA256 signature over the raw
// request body, computed with the EMAIL_WEBHOOK_SECRET shared secret.
//
// Operator setup:
//  1. Generate a random secret: `openssl rand -hex 32`
//  2. Set EMAIL_WEBHOOK_SECRET in Railway env.
//  3. Configure your email provider to add the header
//     `X-Webhook-Signature: sha256=<hex>` where <hex> is HMAC-SHA256(body, secret).
//     Resend supports custom signed headers; SendGrid users can set up a
//     small proxy or use the ed25519 public-key flow (TODO for SendGrid).
//
// Behavior:
//  - In production: secret REQUIRED. Missing → 503. Bad signature → 401.
//  - In dev: secret optional, missing-secret logs a warning and processes anyway.
export function handleEmailWebhook(req: Request, res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  const sigHeader = (req.headers["x-webhook-signature"] || "") as string;
  const rawBody = req.body as Buffer;

  if (!secret) {
    if (isProd) {
      res.status(503).json({ error: "Email webhook secret not configured" });
      return;
    }
    console.warn("[email webhook] EMAIL_WEBHOOK_SECRET not set — accepting unsigned events (dev only)");
  } else {
    if (!sigHeader) {
      res.status(401).json({ error: "Missing signature" });
      return;
    }
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    let ok = false;
    try {
      ok = sigHeader.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
    } catch { ok = false; }
    if (!ok) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // Process events asynchronously after responding so the provider's webhook
  // delivery infrastructure doesn't time out on slow DB writes.
  res.json({ received: true });

  void (async () => {
    try {
      const events = Array.isArray(parsed) ? parsed : [parsed];
      for (const event of events) {
        if (event.event && event.tracking_id) {
          const typeMap: Record<string, string> = {
            delivered: "delivered",
            open: "opened",
            click: "clicked",
            bounce: "bounced",
            dropped: "bounced",
            spamreport: "bounced",
          };
          const t = typeMap[event.event];
          if (t) await logEmailEvent(event.tracking_id, t, event);
        }
        if (event.type && event.data?.headers?.["X-Tracking-Id"]) {
          const trackingId = event.data.headers["X-Tracking-Id"];
          const typeMap: Record<string, string> = {
            "email.delivered": "delivered",
            "email.opened": "opened",
            "email.clicked": "clicked",
            "email.bounced": "bounced",
            "email.complained": "bounced",
          };
          const t = typeMap[event.type];
          if (t) await logEmailEvent(trackingId, t, event.data);
        }
      }
    } catch (err) {
      console.error("[email webhook] processing error:", err);
    }
  })();
}

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

// Track click (no auth - redirect to original URL).
// Security: only redirect to https:// URLs whose host matches an allowlist.
// Anything else returns 400 to prevent open-redirect abuse (phishing landing pages
// using sidedoor.app as a credibility shim).
const REDIRECT_HOST_ALLOWLIST = new Set<string>([
  // Add any extra trusted hosts here (e.g. partner sites we link from emails).
  ...(process.env.APP_URL ? [safeHost(process.env.APP_URL)] : []),
  "thesidedoor.ai",
  "app.thesidedoor.ai",
  "sidedoor.app",
  "www.sidedoor.app",
  "linkedin.com",
  "www.linkedin.com",
].filter(Boolean) as string[]);

function safeHost(input: string): string {
  try { return new URL(input).host; } catch { return ""; }
}

function isRedirectUrlAllowed(url: string): boolean {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  // Strip leading "www." for comparison robustness
  const host = parsed.host.toLowerCase();
  return REDIRECT_HOST_ALLOWLIST.has(host);
}

router.get("/track/click/:trackingId", async (req: Request, res: Response) => {
  const url = (req.query.url as string) || "";
  try {
    await logEmailEvent(req.params.trackingId, "clicked", { url });
  } catch (e) {
    // Don't fail the redirect on logging error
  }
  if (!url) return res.redirect("/");
  if (!isRedirectUrlAllowed(url)) {
    return res.status(400).send("Redirect target not permitted.");
  }
  res.redirect(url);
});

// (Email webhook moved to backend/index.ts so it can receive the raw body
// for HMAC signature verification before express.json() parses. See
// handleEmailWebhook export below.)

// Send email for a contact (authenticated)
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// SECURITY (audit C7/M1/M9):
// - enforceDailySendCap blocks per-plan abuse (free=5, starter=50, pro=200, max=500/day).
// - We reject obviously bad recipient domains (mailinator, etc.).
// - subject/html have hard size caps to limit abuse storage and outbound payload.
// - The route already verifies the user owns the contact via job_submission.
const SUBJECT_MAX = 500;
const HTML_MAX = 100_000; // 100 KB — generous for HTML emails, blocks 1 MB blobs.

router.post("/outreach/send-email", requireAuth, enforceDailySendCap, async (req: Request, res: Response) => {
  if (!isEmailConfigured()) {
    return res.status(503).json({ error: "Email sending is not configured. Contact support to enable." });
  }

  const userId = req.user!.id;
  const { contactId, subject, html } = req.body;

  if (!contactId || !subject || !html) {
    return res.status(400).json({ error: "contactId, subject, and html are required" });
  }
  if (typeof subject !== "string" || subject.length > SUBJECT_MAX) {
    return res.status(400).json({ error: `subject exceeds ${SUBJECT_MAX} characters` });
  }
  if (typeof html !== "string" || html.length > HTML_MAX) {
    return res.status(413).json({ error: `html body exceeds ${HTML_MAX} characters` });
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

  if (!recipientDomainAllowed(contact.email)) {
    return res.status(400).json({ error: "Recipient domain is not permitted." });
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
