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

export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || "",
  pro: process.env.STRIPE_PRO_PRICE_ID || "",
  max: process.env.STRIPE_MAX_PRICE_ID || "",
} as const;

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
