// Single source of truth for all credit/pricing constants
// Display multiplier: 10x (1 raw search = 10 displayed credits)

export const CREDIT_COSTS = {
  JOB_SEARCH: 10,        // Full pipeline: scrape + extract + Apollo + verify + AI messages
  FOLLOWUP_DRAFT: 3,     // Follow-up draft for existing contact (PRO+)
  REDRAFT: 2,            // Re-draft with different tone
  INTERVIEW_PREP: 5,     // Interview prep per company (MAX)
  LINKEDIN_MESSAGE: 2,   // LinkedIn message draft
} as const;

export const PLAN_CREDITS: Record<string, { total: number; monthly: number }> = {
  free:    { total: 50,  monthly: 0 },
  starter: { total: 100, monthly: 100 },
  pro:     { total: 250, monthly: 250 },
  max:     { total: 600, monthly: 600 },
};

export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 15,
  pro: 29,
  max: 49,
};

export const FREE_TIER_DAYS = 21;
export const GRACE_PERIOD_DAYS = 3;

// ── Billing Periods ──────────────────────────────────────────────────
export type BillingPeriod = "monthly" | "3month" | "6month" | "annual";

export const BILLING_PERIODS: {
  id: BillingPeriod;
  label: string;
  months: number;
  discount: number;
  tag: string | null;
}[] = [
  { id: "monthly", label: "Monthly", months: 1, discount: 0, tag: null },
  { id: "3month", label: "3-Month", months: 3, discount: 0.10, tag: "-10%" },
  { id: "6month", label: "6-Month", months: 6, discount: 0.15, tag: "-15%" },
  { id: "annual", label: "Annual", months: 12, discount: 0.20, tag: "-20%" },
];

export function getPlanPrice(
  plan: string,
  period: BillingPeriod
): { perMonth: number; total: number; savings: number } {
  const base = PLAN_PRICES[plan] || 0;
  const periodInfo = BILLING_PERIODS.find((b) => b.id === period)!;
  const discountedMonthly = Math.round(base * (1 - periodInfo.discount));
  const total = discountedMonthly * periodInfo.months;
  const savings = (base * periodInfo.months) - total;
  return { perMonth: discountedMonthly, total, savings };
}

// ── Stripe Price IDs ─────────────────────────────────────────────────
// Each plan has a price ID per billing period.
// These must be created in Stripe Dashboard and set as env vars.
export const STRIPE_PRICE_IDS: Record<string, Record<BillingPeriod, string>> = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || process.env.STRIPE_STARTER_PRICE_ID || "price_1TFGRDLiDTm2SgmCAWKCcImj",
    "3month": process.env.STRIPE_STARTER_3MONTH_PRICE_ID || "price_1TGT4DLiDTm2SgmCsq32cQjd",
    "6month": process.env.STRIPE_STARTER_6MONTH_PRICE_ID || "price_1TGT8CLiDTm2SgmCndM5kGZX",
    annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID || "price_1TGT8CLiDTm2SgmCtfUi42cR",
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID || "price_1TFGRELiDTm2SgmCbjOaW8Km",
    "3month": process.env.STRIPE_PRO_3MONTH_PRICE_ID || "price_1TGT4GLiDTm2SgmCoBEafwKE",
    "6month": process.env.STRIPE_PRO_6MONTH_PRICE_ID || "price_1TGT8ELiDTm2SgmCP2uihSnn",
    annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "price_1TGT8FLiDTm2SgmCSBlq2FNr",
  },
  max: {
    monthly: process.env.STRIPE_MAX_MONTHLY_PRICE_ID || process.env.STRIPE_MAX_PRICE_ID || "price_1TFGRFLiDTm2SgmCk815McTw",
    "3month": process.env.STRIPE_MAX_3MONTH_PRICE_ID || "price_1TGT4KLiDTm2SgmC873vUpuI",
    "6month": process.env.STRIPE_MAX_6MONTH_PRICE_ID || "price_1TGT8GLiDTm2SgmCpu5w6YpZ",
    annual: process.env.STRIPE_MAX_ANNUAL_PRICE_ID || "price_1TGT8HLiDTm2SgmCygvo1M3r",
  },
};

export const PLAN_FEATURES = {
  free: {
    maxContactsPerCompany: 1,
    followUpSequences: false,
    multiStepSequences: false,
    integratedSend: false,
  },
  starter: {
    maxContactsPerCompany: 1,
    followUpSequences: false,
    multiStepSequences: false,
    integratedSend: true,
  },
  pro: {
    maxContactsPerCompany: 999,
    followUpSequences: true,
    multiStepSequences: false,
    integratedSend: true,
  },
  max: {
    maxContactsPerCompany: 999,
    followUpSequences: true,
    multiStepSequences: true,
    integratedSend: true,
  },
} as const;

export type PlanType = "free" | "starter" | "pro" | "max";
export type CreditAction = keyof typeof CREDIT_COSTS;
