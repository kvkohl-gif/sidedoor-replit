// Templates + dispatch for SideDoor's transactional platform emails:
//   - Email verification (called from auth.ts on signup; uses sendTransactionalEmail directly)
//   - Password reset
//   - Welcome (post-verification)
//   - Trial-ending reminders (3 days, 1 day, on the day)
//
// Style note: keep these short, plain, and skimmable. Marketing fluff goes in
// the welcome email at most. Reminders should read like a friendly nudge, not
// a sales push.

import { sendTransactionalEmail } from "./emailService";

const APP_URL = (process.env.APP_URL || "https://app.thesidedoor.ai").replace(/\/$/, "");

// ─── Shared HTML wrapper ─────────────────────────────────────────────
// Inline styles only (most clients strip <style> blocks). Mobile-safe via
// max-width + 100% fallback. Tested in Gmail / Outlook / Apple Mail.
function wrap(opts: { previewText: string; bodyHtml: string }): string {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#F7F5FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A202C;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${opts.previewText}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F7F5FF;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;border:1px solid #E2E8F0;max-width:560px;width:100%;">
        <tr><td style="padding:32px 40px 24px 40px;border-bottom:1px solid #F1F5F9;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#6B46C1,#9F7AEA);border-radius:8px;display:inline-block;text-align:center;line-height:36px;color:#fff;font-weight:600;">SD</div>
            <span style="font-size:16px;font-weight:600;color:#1A202C;vertical-align:middle;margin-left:10px;">The Side Door</span>
          </div>
        </td></tr>
        <tr><td style="padding:32px 40px 24px 40px;font-size:15px;line-height:1.6;color:#1A202C;">
          ${opts.bodyHtml}
        </td></tr>
        <tr><td style="padding:24px 40px 32px 40px;border-top:1px solid #F1F5F9;font-size:12px;color:#A0AEC0;line-height:1.5;">
          You're receiving this because you have a SideDoor account.<br />
          Questions? Reply to this email and we'll get back to you.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
    <tr><td style="border-radius:8px;background:#6B46C1;">
      <a href="${href}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td></tr>
  </table>`;
}

// ─── Password reset ──────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const html = wrap({
    previewText: "Reset your SideDoor password",
    bodyHtml: `
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#1A202C;">Reset your password</h1>
      <p style="margin:0 0 16px 0;">Someone (hopefully you) requested a password reset for your SideDoor account.</p>
      <p style="margin:0 0 16px 0;">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      ${button("Reset password", link)}
      <p style="margin:24px 0 0 0;font-size:13px;color:#718096;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <p style="margin:16px 0 0 0;font-size:12px;color:#A0AEC0;word-break:break-all;">Or copy this link: ${link}</p>
    `,
  });
  const text = `Reset your SideDoor password\n\n${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;
  const r = await sendTransactionalEmail({ to, subject: "Reset your SideDoor password", html, text });
  if (!r.success) console.error(`[platformEmails] password-reset to ${to} failed: ${r.error}`);
}

// ─── Welcome (post-verification) ─────────────────────────────────────
export async function sendWelcomeEmail(to: string, firstName?: string): Promise<void> {
  const greeting = firstName ? `Welcome to SideDoor, ${firstName}!` : "Welcome to SideDoor!";
  const html = wrap({
    previewText: "Your account is live — here's how to get the most out of your trial",
    bodyHtml: `
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#1A202C;">${greeting}</h1>
      <p style="margin:0 0 16px 0;">Your account is verified and you've got <strong>50 free credits</strong> to test things out — enough for around 5 full job searches.</p>
      <p style="margin:0 0 8px 0;font-weight:600;">Three quick tips:</p>
      <ol style="margin:0 0 16px 20px;padding:0;">
        <li style="margin-bottom:8px;">Paste a real job posting URL — the more detail, the better the recruiter matches.</li>
        <li style="margin-bottom:8px;">Fill in your <a href="${APP_URL}/outreach-profile" style="color:#6B46C1;text-decoration:underline;">outreach profile</a> first. The AI uses it to personalize every message.</li>
        <li>Send messages from <em>your</em> email — we draft them, you press send. Replies come straight to your inbox.</li>
      </ol>
      ${button("Run your first search", `${APP_URL}/search`)}
      <p style="margin:24px 0 0 0;font-size:13px;color:#718096;">Your trial runs for 21 days. We'll remind you a few days before it ends.</p>
    `,
  });
  const text = `${greeting}\n\nYour account is verified and you've got 50 free credits — enough for ~5 full job searches.\n\nRun your first search: ${APP_URL}/search\n\nFill in your outreach profile first for the best results: ${APP_URL}/outreach-profile`;
  const r = await sendTransactionalEmail({ to, subject: greeting, html, text });
  if (!r.success) console.error(`[platformEmails] welcome to ${to} failed: ${r.error}`);
}

// ─── Trial-ending reminders ──────────────────────────────────────────
// 3 days out, 1 day out, day-of. Each one has a slightly more urgent tone.
export type TrialReminderStage = "3d" | "1d" | "0d";

export async function sendTrialReminderEmail(
  to: string,
  firstName: string | undefined,
  stage: TrialReminderStage,
): Promise<void> {
  const name = firstName || "there";
  const billingUrl = `${APP_URL}/billing`;

  const copy = {
    "3d": {
      subject: "Your SideDoor trial ends in 3 days",
      heading: `Hey ${name}, your trial ends in 3 days`,
      body: `Just a heads up — your free trial wraps up in 3 days. If you've found SideDoor useful, picking a plan now means zero interruption when the trial ends.`,
      cta: "See plans",
    },
    "1d": {
      subject: "Your SideDoor trial ends tomorrow",
      heading: `Hey ${name}, your trial ends tomorrow`,
      body: `Last chance to lock in a plan before your trial ends. After tomorrow, search and contact-finding will pause until you upgrade.`,
      cta: "Upgrade now",
    },
    "0d": {
      subject: "Your SideDoor trial ended today",
      heading: `Hey ${name}, your trial just ended`,
      body: `Your free trial ended today and your account has been paused. The work you've done is still here — pick any plan and you're back in within 30 seconds.`,
      cta: "Choose a plan",
    },
  }[stage];

  const html = wrap({
    previewText: copy.body,
    bodyHtml: `
      <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#1A202C;">${copy.heading}</h1>
      <p style="margin:0 0 16px 0;">${copy.body}</p>
      ${button(copy.cta, billingUrl)}
      <p style="margin:24px 0 0 0;font-size:13px;color:#718096;">Plans start at $15/month. Cancel any time.</p>
    `,
  });
  const text = `${copy.heading}\n\n${copy.body}\n\n${copy.cta}: ${billingUrl}`;
  const r = await sendTransactionalEmail({ to, subject: copy.subject, html, text });
  if (!r.success) console.error(`[platformEmails] trial-reminder(${stage}) to ${to} failed: ${r.error}`);
}
