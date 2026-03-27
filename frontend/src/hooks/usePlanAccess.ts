import { useQuery } from "@tanstack/react-query";

interface Subscription {
  plan_type: string;
  status: string;
  credits_remaining: number;
  credits_total: number;
  free_tier_expires_at: string | null;
}

export function usePlanAccess() {
  const { data: subscription } = useQuery<Subscription>({
    queryKey: ["/api/billing/subscription"],
  });

  const isFreeTier = subscription?.plan_type === "free";
  const creditsRemaining = subscription?.credits_remaining ?? 0;
  const hasCredits = creditsRemaining > 0;
  const trialExpired = isFreeTier && subscription?.free_tier_expires_at
    ? new Date(subscription.free_tier_expires_at) < new Date()
    : false;

  return {
    canSearch: hasCredits && !trialExpired,
    canGenerateMessage: hasCredits && !trialExpired,
    canViewEmail: hasCredits || !isFreeTier,
    creditBalance: creditsRemaining,
    maxCredits: subscription?.credits_total ?? 0,
    isFreeTier,
    isPaidUser: !isFreeTier,
    planName: subscription?.plan_type ?? "free",
    trialExpired,
    creditsLow: creditsRemaining <= 2 && creditsRemaining > 0,
  };
}
