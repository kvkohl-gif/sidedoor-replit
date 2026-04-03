import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

export interface PlanFeatures {
  outreachProfileSections: string[];
  outreachHubFullAccess: boolean;
  followUpDrafts: boolean;
  linkedinDrafts: boolean;
  redraftMessage: boolean;
  bulkExport: boolean;
  integratedSend: boolean;
  maxContactsPerCompany: number;
}

const DEFAULT_FREE_FEATURES: PlanFeatures = {
  outreachProfileSections: ["resume", "cover"],
  outreachHubFullAccess: false,
  followUpDrafts: false,
  linkedinDrafts: false,
  redraftMessage: false,
  bulkExport: false,
  integratedSend: false,
  maxContactsPerCompany: 999,
};

interface Subscription {
  plan_type: string;
  status: string;
  credits_remaining: number;
  credits_total: number;
  free_tier_expires_at: string | null;
  trial_days_left: number | null;
  trial_expired: boolean;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  stripe_customer_id: boolean;
  features?: PlanFeatures;
}

export function usePlanAccess() {
  const { data: subscription, isLoading } = useQuery<Subscription>({
    queryKey: ["/api/billing/subscription"],
  });

  const isFreeTier = subscription?.plan_type === "free";
  const creditsRemaining = subscription?.credits_remaining ?? 0;
  const hasCredits = creditsRemaining > 0;
  const trialExpired = subscription?.trial_expired ?? false;
  const trialDaysLeft = subscription?.trial_days_left ?? null;
  const isPastDue = subscription?.status === "past_due";
  const features = subscription?.features ?? DEFAULT_FREE_FEATURES;

  const canAccessProfileSection = useCallback(
    (sectionId: string) => features.outreachProfileSections.includes(sectionId),
    [features.outreachProfileSections]
  );

  const requiredPlanFor = useCallback((feature: string): "pro" | "max" => {
    // Features that require max plan
    if (feature === "bulkExport") return "max";
    // Everything else is pro
    return "pro";
  }, []);

  return {
    subscription,
    isLoading,
    features,
    canSearch: hasCredits && !trialExpired && !isPastDue,
    canGenerateMessage: hasCredits && !trialExpired && !isPastDue,
    canViewEmail: hasCredits || !isFreeTier,
    canAccessProfileSection,
    canAccessOutreachHub: features.outreachHubFullAccess,
    canFollowUp: features.followUpDrafts,
    canLinkedinDraft: features.linkedinDrafts,
    canRedraft: features.redraftMessage,
    canBulkExport: features.bulkExport,
    requiredPlanFor,
    creditBalance: creditsRemaining,
    maxCredits: subscription?.credits_total ?? 0,
    isFreeTier,
    isPaidUser: !isFreeTier,
    planName: subscription?.plan_type ?? "free",
    trialExpired,
    trialDaysLeft,
    trialWarning: trialDaysLeft !== null && trialDaysLeft <= 3 && trialDaysLeft > 0,
    creditsLow: creditsRemaining <= 2 && creditsRemaining > 0,
    creditsExhausted: creditsRemaining === 0 && !isFreeTier,
    isPastDue,
    billingCycleEnd: subscription?.billing_cycle_end ?? null,
    hasStripeCustomer: subscription?.stripe_customer_id ?? false,
  };
}
