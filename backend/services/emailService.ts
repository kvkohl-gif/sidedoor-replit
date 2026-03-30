import { supabaseAdmin } from "../lib/supabaseClient";
import { nanoid } from "nanoid";

// Email provider config - gated behind env vars
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || ""; // "sendgrid" or "resend"
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@thesidedoor.ai";
const APP_URL = process.env.APP_URL || "https://app.thesidedoor.ai";

export function isEmailConfigured(): boolean {
  if (EMAIL_PROVIDER === "sendgrid" && SENDGRID_API_KEY) return true;
  if (EMAIL_PROVIDER === "resend" && RESEND_API_KEY) return true;
  return false;
}

export function generateTrackingId(): string {
  return nanoid(24);
}

export function injectTrackingPixel(html: string, trackingId: string): string {
  const pixel = `<img src="${APP_URL}/api/track/open/${trackingId}" width="1" height="1" style="display:none" alt="" />`;
  // Insert before closing </body> or append
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  userId: string;
  contactId: number;
  trackingId: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, error: "Email provider not configured" };
  }

  const htmlWithTracking = injectTrackingPixel(params.html, params.trackingId);

  try {
    let messageId: string | undefined;

    if (EMAIL_PROVIDER === "sendgrid") {
      const sgMail = await import("@sendgrid/mail");
      sgMail.default.setApiKey(SENDGRID_API_KEY);
      const [response] = await sgMail.default.send({
        to: params.to,
        from: EMAIL_FROM,
        subject: params.subject,
        html: htmlWithTracking,
        customArgs: { tracking_id: params.trackingId },
      });
      messageId = response?.headers?.["x-message-id"];
    } else if (EMAIL_PROVIDER === "resend") {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_API_KEY);
      const result = await resend.emails.send({
        from: EMAIL_FROM,
        to: params.to,
        subject: params.subject,
        html: htmlWithTracking,
        headers: { "X-Tracking-Id": params.trackingId },
      });
      messageId = result.data?.id;
    }

    // Log the sent event
    await supabaseAdmin.from("email_events").insert({
      user_id: params.userId,
      recruiter_contact_id: params.contactId,
      event_type: "sent",
      email_message_id: messageId || null,
      tracking_id: params.trackingId,
      metadata: { subject: params.subject, to: params.to },
    });

    return { success: true, messageId };
  } catch (error: any) {
    console.error("[EmailService] Send failed:", error.message);
    return { success: false, error: error.message };
  }
}

export async function logEmailEvent(
  trackingId: string,
  eventType: string,
  metadata?: Record<string, any>
): Promise<void> {
  // Look up the original sent event to get user_id and contact_id
  const { data: original } = await supabaseAdmin
    .from("email_events")
    .select("user_id, recruiter_contact_id")
    .eq("tracking_id", trackingId)
    .eq("event_type", "sent")
    .single();

  if (!original) {
    console.warn(`[EmailService] No sent event found for tracking_id: ${trackingId}`);
    return;
  }

  // Check for duplicate events (don't log multiple opens)
  if (eventType === "opened") {
    const { data: existing } = await supabaseAdmin
      .from("email_events")
      .select("id")
      .eq("tracking_id", trackingId)
      .eq("event_type", "opened")
      .limit(1);
    if (existing && existing.length > 0) return; // Already logged
  }

  await supabaseAdmin.from("email_events").insert({
    user_id: original.user_id,
    recruiter_contact_id: original.recruiter_contact_id,
    event_type: eventType,
    tracking_id: trackingId,
    metadata: metadata || {},
  });

  // Auto-update contact status for meaningful events
  if (eventType === "replied") {
    await supabaseAdmin
      .from("recruiter_contacts")
      .update({ contact_status: "replied", last_activity_at: new Date().toISOString() })
      .eq("id", original.recruiter_contact_id);
  }
}
