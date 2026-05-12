import { STRIPE_PRICE_IDS } from "../constants/credits";

const isProd = (process.env.APP_ENV || process.env.NODE_ENV) === "production";

// BILLING_ENABLED kill switch — defaults to true. Set BILLING_ENABLED=false to
// short-circuit checkout/portal/change-plan routes (returns 503).
export const BILLING_ENABLED = process.env.BILLING_ENABLED !== "false";

type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export function validateBillingConfig(): ValidationResult {
  const errors: string[] = [];
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhook = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    errors.push("STRIPE_SECRET_KEY is not set");
  } else if (isProd && !secret.startsWith("sk_live_")) {
    errors.push(
      "STRIPE_SECRET_KEY must be a live key (sk_live_...) in production. " +
        "Found a non-live key — refusing to charge customers with a test key.",
    );
  }

  if (!webhook) {
    errors.push("STRIPE_WEBHOOK_SECRET is not set");
  }

  for (const [plan, periods] of Object.entries(STRIPE_PRICE_IDS)) {
    for (const [period, priceId] of Object.entries(periods)) {
      if (!priceId) {
        errors.push(
          `Stripe price ID missing for ${plan}/${period} ` +
            `(env var STRIPE_${plan.toUpperCase()}_${period.toUpperCase()}_PRICE_ID)`,
        );
      } else if (isProd && !priceId.startsWith("price_")) {
        errors.push(
          `Stripe price ID for ${plan}/${period} does not look valid: ${priceId}`,
        );
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// Run at module import: log warnings in dev, throw in production.
export function assertBillingConfigOnStartup(): void {
  if (!BILLING_ENABLED) {
    console.warn("[billing] BILLING_ENABLED=false — checkout endpoints disabled");
    return;
  }

  const result = validateBillingConfig();
  if (result.ok) {
    console.log("[billing] config validated");
    return;
  }

  const message =
    "[billing] configuration errors:\n" +
    result.errors.map((e) => `  - ${e}`).join("\n");

  if (isProd) {
    throw new Error(message);
  }
  console.warn(message);
}

// ─── Security config validation (audit-driven) ───────────────────────
// Production must have CAPTCHA + email-webhook secret + an email provider
// configured. Without these, the app's bot defenses and webhook integrity
// checks degrade silently. Fail fast at boot instead.
export function assertSecurityConfigOnStartup(): void {
  if (!isProd) {
    console.log("[security] non-prod env — skipping strict security config check");
    return;
  }

  const errors: string[] = [];

  if (!process.env.TURNSTILE_SECRET_KEY) {
    errors.push(
      "TURNSTILE_SECRET_KEY is not set — signup CAPTCHA will reject every request. " +
        "Get a free Cloudflare Turnstile sitekey + secret at https://dash.cloudflare.com/?to=/:account/turnstile.",
    );
  }
  if (!process.env.EMAIL_WEBHOOK_SECRET) {
    errors.push(
      "EMAIL_WEBHOOK_SECRET is not set — /api/webhooks/email will return 503. " +
        "Generate with `openssl rand -hex 32` and configure your email provider to send X-Webhook-Signature header.",
    );
  }
  // Email provider needed for verification + reset emails.
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (provider !== "resend" && provider !== "sendgrid") {
    errors.push(`EMAIL_PROVIDER must be "resend" or "sendgrid" (got "${provider}")`);
  } else if (provider === "resend" && !process.env.RESEND_API_KEY) {
    errors.push("EMAIL_PROVIDER=resend but RESEND_API_KEY is not set");
  } else if (provider === "sendgrid" && !process.env.SENDGRID_API_KEY) {
    errors.push("EMAIL_PROVIDER=sendgrid but SENDGRID_API_KEY is not set");
  }
  if (!process.env.EMAIL_FROM) {
    errors.push("EMAIL_FROM is not set — verification emails won't have a From address");
  }

  if (errors.length === 0) {
    console.log("[security] config validated");
    return;
  }

  throw new Error(
    "[security] configuration errors:\n" +
      errors.map((e) => `  - ${e}`).join("\n"),
  );
}
