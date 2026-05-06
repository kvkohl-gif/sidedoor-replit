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
