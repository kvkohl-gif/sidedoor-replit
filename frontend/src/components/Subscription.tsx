import { Check, Zap, CreditCard, ExternalLink, Clock, Shield, Sparkles, Crown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

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

// ── Billing periods ──────────────────────────────────────────────────
type BillingPeriod = "monthly" | "3month" | "6month" | "annual";

const BILLING_PERIODS: {
  id: BillingPeriod;
  label: string;
  months: number;
  discount: number;
  tag: string | null;
}[] = [
  { id: "monthly", label: "Monthly", months: 1, discount: 0, tag: null },
  { id: "3month", label: "3-Month", months: 3, discount: 0.10, tag: "-10%" },
  { id: "6month", label: "6-Month", months: 6, discount: 0.20, tag: "-20%" },
  { id: "annual", label: "Annual", months: 12, discount: 0.30, tag: "-30%" },
];

function getPlanPrice(baseMo: number, period: BillingPeriod) {
  const info = BILLING_PERIODS.find((b) => b.id === period)!;
  const discounted = Math.round(baseMo * (1 - info.discount));
  return {
    perMonth: discounted,
    total: discounted * info.months,
    savings: baseMo * info.months - discounted * info.months,
  };
}

// ── Plan data ────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "starter",
    name: "STARTER",
    baseMo: 15,
    credits: "100 credits",
    searches: "10 searches / mo",
    tagline: "Essential tools for the casual job seeker.",
    features: [
      "Basic AI outreach engine",
      "10 company searches / mo",
      "Verified professional contacts",
      "Email message drafts",
    ],
    ctaLabel: "Get Started",
    ctaStyle: "outline" as const,
  },
  {
    id: "pro",
    name: "PROFESSIONAL",
    baseMo: 29,
    credits: "250 credits",
    searches: "25 searches / mo",
    tagline: "Complete access for serious career climbers.",
    popular: true,
    highlight: "Advanced AI Personalization",
    features: [
      "Unlimited company searches",
      "Follow-up draft sequences",
      "LinkedIn message drafts",
      "Priority customer support",
    ],
    ctaLabel: "Get Started Now",
    ctaStyle: "solid" as const,
  },
  {
    id: "max",
    name: "EXECUTIVE",
    baseMo: 49,
    credits: "600 credits",
    searches: "60 searches / mo",
    tagline: "White-glove service for top-tier placements.",
    features: [
      "Everything in Professional",
      "Interview prep per company",
      "Bulk contact & CSV export",
      "Early access to beta features",
    ],
    ctaLabel: "Go Executive",
    ctaStyle: "dark" as const,
  },
];

// ── Component ────────────────────────────────────────────────────────
export function Subscription() {
  const [activeTab, setActiveTab] = useState<"plan" | "credits" | "history">("plan");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  // Responsive: measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setIsNarrow(entries[0].contentRect.width < 700);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  const trialDaysLeft =
    subscription?.plan_type === "free" && subscription?.free_tier_expires_at
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.free_tier_expires_at).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  // Annual savings for the nudge line
  const proAnnualSavings = getPlanPrice(29, "annual").savings;

  const handleUpgrade = async (planType: string) => {
    if (planType === "free" || planType === currentPlan) return;
    setUpgrading(planType);
    try {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planType, billingPeriod }),
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

  const urlParams = new URLSearchParams(window.location.search);
  const justUpgraded = urlParams.get("upgraded") === "true";

  const tabs = [
    { id: "plan" as const, label: "Plan" },
    { id: "credits" as const, label: "Credits" },
    { id: "history" as const, label: "History" },
  ];

  // ── Plan Tab ─────────────────────────────────────────────────────
  const renderPlanTab = () => (
    <>
      {/* Success banner */}
      {justUpgraded && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: 10,
            padding: "14px 20px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#d1fae5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check style={{ width: 18, height: 18, color: "#059669" }} />
          </div>
          <div>
            <p style={{ fontWeight: 600, color: "#065f46", margin: 0, fontSize: 14 }}>
              Upgrade successful!
            </p>
            <p style={{ color: "#047857", margin: 0, fontSize: 13 }}>
              Your credits have been updated.
            </p>
          </div>
        </div>
      )}

      {/* Current plan banner */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  padding: "4px 12px",
                  background: "#f5f3ff",
                  color: "#6B46C1",
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {currentPlan === "free" ? "Free Trial" : `${currentPlan} Plan`}
              </span>
              {subscription?.status === "past_due" && (
                <span
                  style={{
                    padding: "4px 12px",
                    background: "#fef2f2",
                    color: "#dc2626",
                    borderRadius: 20,
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  Payment Past Due
                </span>
              )}
            </div>
            <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
              {currentPlan === "free"
                ? `You're on the free trial.${trialDaysLeft !== null ? ` ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining.` : ""} Upgrade to keep your pipeline running.`
                : `You have ${creditsRemaining} of ${creditsTotal} credits remaining this cycle.`}
            </p>
          </div>
          {subscription?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                color: "#6b7280",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#6B46C1";
                e.currentTarget.style.color = "#6B46C1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e5e7eb";
                e.currentTarget.style.color = "#6b7280";
              }}
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
              Manage Billing
            </button>
          )}
        </div>
      </div>

      {/* Billing period toggle */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            borderRadius: 12,
            padding: 4,
            gap: 2,
          }}
        >
          {BILLING_PERIODS.map((bp) => {
            const active = billingPeriod === bp.id;
            return (
              <button
                key={bp.id}
                onClick={() => setBillingPeriod(bp.id)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  background: active ? "#6B46C1" : "transparent",
                  color: active ? "#fff" : "#64748b",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {bp.label}
                {bp.tag && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      opacity: active ? 0.9 : 0.7,
                      fontWeight: 500,
                    }}
                  >
                    ({bp.tag})
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {billingPeriod !== "monthly" && (
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "#059669",
              fontWeight: 500,
            }}
          >
            Save up to ${proAnnualSavings}/year on the Professional plan
          </p>
        )}
      </div>

      {/* Plan cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, 1fr)",
          gap: 24,
          alignItems: "start",
          marginBottom: 32,
        }}
      >
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isDowngrade = getPlanRank(plan.id) < getPlanRank(currentPlan);
          const price = getPlanPrice(plan.baseMo, billingPeriod);
          const isPopular = plan.popular;

          return (
            <div
              key={plan.id}
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: 16,
                border: isPopular
                  ? "2px solid #6B46C1"
                  : isCurrent
                    ? "2px solid #6B46C1"
                    : "1px solid #e5e7eb",
                padding: isPopular ? "32px 28px 28px" : "28px 24px 24px",
                boxShadow: isPopular
                  ? "0 8px 30px rgba(107, 70, 193, 0.12)"
                  : "0 1px 3px rgba(0,0,0,0.04)",
                transform: isPopular && !isNarrow ? "scale(1.04)" : "none",
                zIndex: isPopular ? 2 : 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Badge */}
              {isPopular && !isCurrent && (
                <div
                  style={{
                    position: "absolute",
                    top: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "5px 16px",
                    background: "#6B46C1",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 20,
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  MOST POPULAR
                </div>
              )}
              {isCurrent && (
                <div
                  style={{
                    position: "absolute",
                    top: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "5px 16px",
                    background: "#059669",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 20,
                    letterSpacing: "0.05em",
                  }}
                >
                  CURRENT
                </div>
              )}

              {/* Plan name */}
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: isPopular ? "#6B46C1" : "#374151",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                {plan.name}
              </h3>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: "#111827", lineHeight: 1 }}>
                  ${price.perMonth}
                </span>
                <span style={{ fontSize: 15, color: "#9ca3af", fontWeight: 400 }}>/mo</span>
              </div>

              {/* Show original price struck through if discounted */}
              {billingPeriod !== "monthly" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#d1d5db",
                      textDecoration: "line-through",
                    }}
                  >
                    ${plan.baseMo}/mo
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#059669",
                      fontWeight: 600,
                      background: "#ecfdf5",
                      padding: "2px 8px",
                      borderRadius: 12,
                    }}
                  >
                    Save ${price.savings}
                  </span>
                </div>
              )}

              {/* Tagline */}
              <p style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 20px", lineHeight: 1.4 }}>
                {plan.tagline}
              </p>

              {/* Divider */}
              <div style={{ height: 1, background: "#f3f4f6", margin: "0 0 20px" }} />

              {/* Highlight feature for Pro */}
              {plan.highlight && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 16,
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#111827",
                  }}
                >
                  <Sparkles style={{ width: 18, height: 18, color: "#6B46C1" }} />
                  {plan.highlight}
                </div>
              )}

              {/* Features */}
              <div style={{ flex: 1, marginBottom: 24 }}>
                {plan.features.map((feat) => (
                  <div
                    key={feat}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "6px 0",
                      fontSize: 14,
                      color: "#374151",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#f5f3ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <Check style={{ width: 12, height: 12, color: "#6B46C1" }} />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isCurrent ? (
                <div
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    textAlign: "center",
                    color: "#6B46C1",
                    fontWeight: 600,
                    fontSize: 14,
                    background: "#f5f3ff",
                    borderRadius: 10,
                  }}
                >
                  Current Plan
                </div>
              ) : isDowngrade ? (
                <button
                  onClick={handleManageBilling}
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 13,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Manage in Billing Portal
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading !== null}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: upgrading === plan.id ? "wait" : "pointer",
                    opacity: upgrading === plan.id ? 0.6 : 1,
                    transition: "all 0.2s",
                    border:
                      plan.ctaStyle === "outline"
                        ? "2px solid #e5e7eb"
                        : "none",
                    background:
                      plan.ctaStyle === "solid"
                        ? "#6B46C1"
                        : plan.ctaStyle === "dark"
                          ? "#1f2937"
                          : "#fff",
                    color:
                      plan.ctaStyle === "outline"
                        ? "#374151"
                        : "#fff",
                  }}
                  onMouseEnter={(e) => {
                    if (plan.ctaStyle === "outline") {
                      e.currentTarget.style.borderColor = "#6B46C1";
                      e.currentTarget.style.color = "#6B46C1";
                    } else if (plan.ctaStyle === "solid") {
                      e.currentTarget.style.background = "#5a3ba1";
                    } else {
                      e.currentTarget.style.background = "#111827";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (plan.ctaStyle === "outline") {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                      e.currentTarget.style.color = "#374151";
                    } else if (plan.ctaStyle === "solid") {
                      e.currentTarget.style.background = "#6B46C1";
                    } else {
                      e.currentTarget.style.background = "#1f2937";
                    }
                  }}
                >
                  {upgrading === plan.id ? "Redirecting..." : plan.ctaLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Trust line */}
      <div
        style={{
          textAlign: "center",
          padding: "16px 0 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: "#9ca3af",
          fontSize: 13,
        }}
      >
        <Shield style={{ width: 14, height: 14 }} />
        Cancel anytime · No hidden fees · 7-day money-back guarantee
      </div>
    </>
  );

  // ── Credits Tab ──────────────────────────────────────────────────
  const renderCreditsTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#f5f3ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Zap style={{ width: 24, height: 24, color: "#6B46C1" }} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>
              Credit Balance
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              Each job search uses 10 credits. Your balance resets at the start of each billing cycle.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: "#111827" }}>{creditsRemaining}</span>
          <span style={{ fontSize: 14, color: "#9ca3af" }}>of {creditsTotal} credits</span>
        </div>

        <div
          style={{
            width: "100%",
            height: 10,
            background: "#f1f5f9",
            borderRadius: 999,
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 999,
              transition: "width 0.5s ease",
              width: `${percentage}%`,
              background:
                percentage > 50
                  ? "linear-gradient(90deg, #6B46C1, #9F7AEA)"
                  : percentage > 20
                    ? "linear-gradient(90deg, #d97706, #f59e0b)"
                    : "linear-gradient(90deg, #dc2626, #ef4444)",
            }}
          />
        </div>

        {trialDaysLeft !== null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            <Clock style={{ width: 14, height: 14 }} />
            {trialDaysLeft > 0
              ? `Free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""}`
              : "Free trial has expired"}
          </div>
        )}

        {subscription?.billing_cycle_end && (
          <p style={{ fontSize: 13, color: "#6b7280", margin: "8px 0 0" }}>
            Credits reset on{" "}
            {new Date(subscription.billing_cycle_end).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Credit costs */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "0 0 16px" }}>
          Credit Costs
        </h3>
        {[
          { action: "Job Search (full pipeline)", cost: 10 },
          { action: "Follow-up Draft", cost: 3, badge: "Pro+" },
          { action: "Re-draft with Different Tone", cost: 2 },
          { action: "Interview Prep", cost: 5, badge: "Executive" },
          { action: "LinkedIn Message Draft", cost: 2, badge: "Pro+" },
        ].map((item, idx, arr) => (
          <div
            key={item.action}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: idx < arr.length - 1 ? "1px solid #f3f4f6" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: "#374151" }}>{item.action}</span>
              {item.badge && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: "#f5f3ff",
                    color: "#6B46C1",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              {item.cost} credits
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── History Tab ──────────────────────────────────────────────────
  const renderHistoryTab = () => (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: 0 }}>
          Transaction History
        </h2>
      </div>
      {transactions.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af" }}>
          <CreditCard style={{ width: 32, height: 32, margin: "0 auto 12px", opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: 14 }}>No transactions yet</p>
        </div>
      ) : (
        <div>
          {transactions.map((tx, idx) => (
            <div
              key={tx.id}
              style={{
                padding: "14px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: idx < transactions.length - 1 ? "1px solid #f3f4f6" : "none",
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#111827", margin: 0 }}>
                  {tx.description}
                </p>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                  {new Date(tx.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: tx.amount > 0 ? "#059669" : "#ef4444",
                  }}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount} credits
                </span>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}>
                  Balance: {tx.balance_after}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: "32px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{ height: 32, background: "#f3f4f6", borderRadius: 8, width: 200 }}
          />
          <div
            style={{ height: 16, background: "#f3f4f6", borderRadius: 8, width: 300 }}
          />
          <div style={{ height: 200, background: "#f3f4f6", borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ padding: isNarrow ? 16 : 32, maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
          Plan and Billing
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          Manage your subscription, credits, and billing
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          borderBottom: "1px solid #e5e7eb",
          marginBottom: 32,
          display: "flex",
          gap: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 500,
              color: activeTab === tab.id ? "#6B46C1" : "#6b7280",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #6B46C1" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
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
