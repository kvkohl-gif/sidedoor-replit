import { useQuery } from "@tanstack/react-query";

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

  return {
    subscription,
    isLoading,
    canSearch: hasCredits && !trialExpired && !isPastDue,
    canGenerateMessage: hasCredits && !trialExpired && !isPastDue,
    canViewEmail: hasCredits || !isFreeTier,
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
