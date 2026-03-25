import { Check, X, Zap, CreditCard, ArrowUpRight, Clock, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface SubscriptionData {
  plan_type: string;
  status: string;
  credits_remaining: number;
  credits_total: number;
  free_tier_expires_at: string | null;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  stripe_customer_id: boolean;
}

interface Transaction {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  description: string;
  created_at: string;
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "21-day trial",
    credits: "50 credits",
    rawSearches: "5 searches",
    features: {
      jobSearch: true,
      aiMessages: true,
      emailVerification: true,
      followUpDrafts: false,
      interviewPrep: false,
      linkedinDrafts: false,
    },
  },
  {
    id: "starter",
    name: "Starter",
    price: "$15",
    period: "/month",
    credits: "100 credits",
    rawSearches: "10 searches/mo",
    features: {
      jobSearch: true,
      aiMessages: true,
      emailVerification: true,
      followUpDrafts: false,
      interviewPrep: false,
      linkedinDrafts: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/month",
    credits: "250 credits",
    rawSearches: "25 searches/mo",
    popular: true,
    features: {
      jobSearch: true,
      aiMessages: true,
      emailVerification: true,
      followUpDrafts: true,
      interviewPrep: false,
      linkedinDrafts: true,
    },
  },
  {
    id: "max",
    name: "Max",
    price: "$49",
    period: "/month",
    credits: "600 credits",
    rawSearches: "60 searches/mo",
    features: {
      jobSearch: true,
      aiMessages: true,
      emailVerification: true,
      followUpDrafts: true,
      interviewPrep: true,
      linkedinDrafts: true,
    },
  },
];

const FEATURE_LABELS: Record<string, string> = {
  jobSearch: "Job Search Pipeline",
  aiMessages: "AI Email & LinkedIn Messages",
  emailVerification: "Email Verification",
  followUpDrafts: "Follow-up Drafts (3 credits)",
  interviewPrep: "Interview Prep (5 credits)",
  linkedinDrafts: "LinkedIn Message Drafts (2 credits)",
};

export function Subscription() {
  const [activeTab, setActiveTab] = useState<"plan" | "credits" | "history">("plan");
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/billing/transactions"],
    enabled: activeTab === "history",
  });

  const currentPlan = subscription?.plan_type || "free";
  const creditsRemaining = subscription?.credits_remaining ?? 0;
  const creditsTotal = subscription?.credits_total ?? 50;
  const percentage = creditsTotal > 0 ? (creditsRemaining / creditsTotal) * 100 : 0;

  const trialDaysLeft = subscription?.plan_type === "free" && subscription?.free_tier_expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.free_tier_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleUpgrade = async (planType: string) => {
    if (planType === "free" || planType === currentPlan) return;
    setUpgrading(planType);

    try {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planType }),
      });

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to start checkout");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch (error) {
      console.error("Portal error:", error);
    }
  };

  // Check for upgrade success via URL param
  const urlParams = new URLSearchParams(window.location.search);
  const justUpgraded = urlParams.get("upgraded") === "true";

  const tabs = [
    { id: "plan" as const, label: "Plan" },
    { id: "credits" as const, label: "Credits" },
    { id: "history" as const, label: "History" },
  ];

  const renderPlanTab = () => (
    <>
      {justUpgraded && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-green-800 font-medium">Upgrade successful!</p>
            <p className="text-green-600 text-sm">Your credits have been updated.</p>
          </div>
        </div>
      )}

      {/* Current Plan Banner */}
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-purple-100 text-[#6B46C1] rounded-full font-medium capitalize">
                {currentPlan} Plan
              </span>
              {subscription?.status === "past_due" && (
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium text-sm">
                  Payment Past Due
                </span>
              )}
            </div>
            <p className="text-[#718096] mb-2">
              {currentPlan === "free"
                ? `You're on the free trial. ${trialDaysLeft !== null ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining.` : ""}`
                : `You have ${creditsRemaining} of ${creditsTotal} credits remaining this cycle.`}
            </p>
          </div>
          {subscription?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#64748B] text-sm hover:bg-white hover:border-[#6B46C1] hover:text-[#6B46C1] transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Manage Billing
            </button>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isDowngrade = getPlanRank(plan.id) < getPlanRank(currentPlan);
          const isPopular = (plan as any).popular;

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-xl border-2 p-6 flex flex-col ${
                isCurrent
                  ? "border-[#6B46C1] shadow-md"
                  : isPopular
                    ? "border-purple-200 shadow-sm"
                    : "border-[#E2E8F0]"
              }`}
            >
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#6B46C1] text-white text-xs font-bold rounded-full">
                  POPULAR
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                  CURRENT
                </div>
              )}

              <h3 className="text-lg font-semibold text-[#1A202C] mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-[#1A202C]">{plan.price}</span>
                <span className="text-[#94A3B8] text-sm">{plan.period}</span>
              </div>
              <p className="text-[#6B46C1] font-medium text-sm mb-4">{plan.credits} &middot; {plan.rawSearches}</p>

              <div className="space-y-2 flex-1 mb-6">
                {Object.entries(plan.features).map(([key, enabled]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    {enabled ? (
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-[#CBD5E0] flex-shrink-0" />
                    )}
                    <span className={enabled ? "text-[#4A5568]" : "text-[#CBD5E0]"}>
                      {FEATURE_LABELS[key]}
                    </span>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <div className="w-full py-2.5 text-center text-[#6B46C1] font-medium text-sm bg-purple-50 rounded-lg">
                  Current Plan
                </div>
              ) : isDowngrade ? (
                <div className="w-full py-2.5 text-center text-[#94A3B8] text-sm">
                  —
                </div>
              ) : plan.id === "free" ? null : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading !== null}
                  className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                    isPopular
                      ? "bg-[#6B46C1] text-white hover:bg-[#5a3ba1]"
                      : "bg-[#F7F5FF] text-[#6B46C1] hover:bg-[#EDE9FF]"
                  } ${upgrading === plan.id ? "opacity-50 cursor-wait" : ""}`}
                >
                  {upgrading === plan.id ? (
                    "Redirecting..."
                  ) : (
                    <>
                      Upgrade <ArrowUpRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const renderCreditsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6 text-[#6B46C1]" />
          </div>
          <div className="flex-1">
            <h2 className="text-[#1A202C] mb-1">Credit Balance</h2>
            <p className="text-[#718096] text-sm">
              Each job search uses 10 credits. Your balance resets at the start of each billing cycle.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-[#1A202C]">{creditsRemaining}</span>
            <span className="text-[#94A3B8]">of {creditsTotal} credits</span>
          </div>

          <div className="w-full bg-[#E2E8F0] rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                percentage > 50
                  ? "bg-gradient-to-r from-[#6B46C1] to-[#9F7AEA]"
                  : percentage > 20
                    ? "bg-gradient-to-r from-[#d97706] to-[#f59e0b]"
                    : "bg-gradient-to-r from-[#dc2626] to-[#ef4444]"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          {trialDaysLeft !== null && (
            <div className="flex items-center gap-2 text-sm text-[#718096]">
              <Clock className="w-4 h-4" />
              {trialDaysLeft > 0
                ? `Free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""}`
                : "Free trial has expired"}
            </div>
          )}

          {subscription?.billing_cycle_end && (
            <p className="text-[#718096] text-sm">
              Credits reset on {new Date(subscription.billing_cycle_end).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {/* Credit Costs Reference */}
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6">
        <h3 className="text-[#1A202C] font-medium mb-4">Credit Costs</h3>
        <div className="space-y-3">
          {[
            { action: "Job Search (full pipeline)", cost: 10 },
            { action: "Follow-up Draft", cost: 3, badge: "Pro+" },
            { action: "Re-draft with Different Tone", cost: 2 },
            { action: "Interview Prep", cost: 5, badge: "Max" },
            { action: "LinkedIn Message Draft", cost: 2, badge: "Pro+" },
          ].map((item) => (
            <div key={item.action} className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-[#4A5568] text-sm">{item.action}</span>
                {item.badge && (
                  <span className="text-[10px] font-medium bg-purple-100 text-[#6B46C1] px-1.5 py-0.5 rounded">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[#1A202C] font-medium text-sm">{item.cost} credits</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden">
      <div className="p-6 border-b border-[#E2E8F0]">
        <h2 className="text-[#1A202C]">Transaction History</h2>
      </div>
      {transactions.length === 0 ? (
        <div className="p-12 text-center text-[#94A3B8]">
          <CreditCard className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>No transactions yet</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F1F5F9]">
          {transactions.map((tx) => (
            <div key={tx.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-[#1A202C] text-sm font-medium">{tx.description}</p>
                <p className="text-[#94A3B8] text-xs mt-0.5">
                  {new Date(tx.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-sm font-semibold ${
                    tx.amount > 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount} credits
                </span>
                <p className="text-[#94A3B8] text-xs">Balance: {tx.balance_after}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-72" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[#1A202C] mb-2">Plan and Billing</h1>
        <p className="text-[#718096]">Manage your subscription, credits, and billing</p>
      </div>

      <div className="border-b border-[#E2E8F0] mb-8">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-[#6B46C1]"
                  : "text-[#718096] hover:text-[#1A202C]"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6B46C1]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "plan" && renderPlanTab()}
      {activeTab === "credits" && renderCreditsTab()}
      {activeTab === "history" && renderHistoryTab()}
    </div>
  );
}

function getPlanRank(planId: string): number {
  const ranks: Record<string, number> = { free: 0, starter: 1, pro: 2, max: 3 };
  return ranks[planId] ?? 0;
}
