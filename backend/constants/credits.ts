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
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || process.env.STRIPE_STARTER_PRICE_ID || "price_1THsIuLkrZkecmzO8KxCEGW7",
    "3month": process.env.STRIPE_STARTER_3MONTH_PRICE_ID || "price_1THsIuLkrZkecmzOdZGMpDru",
    "6month": process.env.STRIPE_STARTER_6MONTH_PRICE_ID || "price_1THsIvLkrZkecmzOQEMV1KnU",
    annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID || "price_1THsIvLkrZkecmzOFbLSHe10",
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID || "price_1THsJ7LkrZkecmzOoidQr4ou",
    "3month": process.env.STRIPE_PRO_3MONTH_PRICE_ID || "price_1THsJ7LkrZkecmzOZItdQyvo",
    "6month": process.env.STRIPE_PRO_6MONTH_PRICE_ID || "price_1THsJ7LkrZkecmzO8cddkDDb",
    annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "price_1THsJ8LkrZkecmzORmFzIOhG",
  },
  max: {
    monthly: process.env.STRIPE_MAX_MONTHLY_PRICE_ID || process.env.STRIPE_MAX_PRICE_ID || "price_1THsJILkrZkecmzOeDThjw3k",
    "3month": process.env.STRIPE_MAX_3MONTH_PRICE_ID || "price_1THsJJLkrZkecmzOiDFFSd3e",
    "6month": process.env.STRIPE_MAX_6MONTH_PRICE_ID || "price_1THsJJLkrZkecmzOGJUFqClj",
    annual: process.env.STRIPE_MAX_ANNUAL_PRICE_ID || "price_1THsJJLkrZkecmzO3umFsFhn",
  },
};

// All profile section IDs
const ALL_PROFILE_SECTIONS = ["resume", "bio", "achievements", "goals", "voice", "hooks", "cover", "hobbies"] as const;
const STARTER_PROFILE_SECTIONS = ["resume", "cover"] as const;

export const PLAN_FEATURES = {
  free: {
    maxContactsPerCompany: 999,
    outreachProfileSections: [...STARTER_PROFILE_SECTIONS] as string[],
    outreachHubFullAccess: false,
    followUpDrafts: false,
    linkedinDrafts: false,
    redraftMessage: false,
    bulkExport: false,
    integratedSend: false,
  },
  starter: {
    maxContactsPerCompany: 999,
    outreachProfileSections: [...STARTER_PROFILE_SECTIONS] as string[],
    outreachHubFullAccess: false,
    followUpDrafts: false,
    linkedinDrafts: false,
    redraftMessage: false,
    bulkExport: false,
    integratedSend: true,
  },
  pro: {
    maxContactsPerCompany: 999,
    outreachProfileSections: [...ALL_PROFILE_SECTIONS] as string[],
    outreachHubFullAccess: true,
    followUpDrafts: true,
    linkedinDrafts: true,
    redraftMessage: true,
    bulkExport: false,
    integratedSend: true,
  },
  max: {
    maxContactsPerCompany: 999,
    outreachProfileSections: [...ALL_PROFILE_SECTIONS] as string[],
    outreachHubFullAccess: true,
    followUpDrafts: true,
    linkedinDrafts: true,
    redraftMessage: true,
    bulkExport: true,
    integratedSend: true,
  },
} as const;

export type PlanFeatures = typeof PLAN_FEATURES[PlanType];

export type PlanType = "free" | "starter" | "pro" | "max";
export type CreditAction = keyof typeof CREDIT_COSTS;
