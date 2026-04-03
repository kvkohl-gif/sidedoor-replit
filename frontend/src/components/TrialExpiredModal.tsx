import { useState } from "react";
import { Sparkles, Check, ArrowRight, LogOut } from "lucide-react";

interface TrialExpiredModalProps {
  onLogout: () => void;
}

type BillingPeriod = "monthly" | "3month" | "6month" | "annual";

const BILLING_PERIODS: { id: BillingPeriod; label: string; months: number; discount: number; tag: string | null }[] = [
  { id: "monthly", label: "Monthly", months: 1, discount: 0, tag: null },
  { id: "3month", label: "3-Month", months: 3, discount: 0.10, tag: "-10%" },
  { id: "6month", label: "6-Month", months: 6, discount: 0.15, tag: "-15%" },
  { id: "annual", label: "Annual", months: 12, discount: 0.20, tag: "-20%" },
];

const PLAN_PRICES: Record<string, number> = { starter: 15, pro: 29, max: 49 };

function getPlanPrice(plan: string, period: BillingPeriod) {
  const base = PLAN_PRICES[plan] || 0;
  const p = BILLING_PERIODS.find((b) => b.id === period)!;
  const perMonth = Math.round(base * (1 - p.discount));
  const total = perMonth * p.months;
  const savings = base * p.months - total;
  return { perMonth, total, savings };
}

const PLANS = [
  {
    id: "starter",
    name: "STARTER",
    tagline: "Essential tools for the casual job seeker.",
    features: [
      "100 credits (~10 searches/mo)",
      "AI outreach emails",
      "Verified recruiter contacts",
      "Resume & cover letter profile",
    ],
    credits: 100,
  },
  {
    id: "pro",
    name: "PROFESSIONAL",
    tagline: "Complete access for serious career climbers.",
    popular: true,
    highlight: "Full AI Personalization",
    features: [
      "250 credits (~25 searches/mo)",
      "Full Outreach Profile (6 sections)",
      "Outreach Hub & pipeline tracking",
      "Follow-up & LinkedIn drafts",
    ],
    credits: 250,
  },
  {
    id: "max",
    name: "EXECUTIVE",
    tagline: "White-glove service for top-tier placements.",
    features: [
      "600 credits (~60 searches/mo)",
      "Everything in Professional",
      "Bulk contact & CSV export",
      "Priority support & early access",
    ],
    credits: 600,
  },
];

export function TrialExpiredModal({ onLogout }: TrialExpiredModalProps) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [isRedirecting, setIsRedirecting] = useState<string | null>(null);

  const handleUpgrade = async (planType: string) => {
    setIsRedirecting(planType);
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
        setIsRedirecting(null);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setIsRedirecting(null);
    }
  };

  const selectedPeriod = BILLING_PERIODS.find((b) => b.id === billingPeriod)!;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          maxWidth: 960,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "48px 40px 32px",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: "#F3E8FF",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Sparkles style={{ width: 28, height: 28, color: "#7C3AED" }} />
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#1a1a2e",
              margin: "0 0 8px",
            }}
          >
            Your Free Trial Has Ended
          </h1>
          <p style={{ color: "#6b7280", fontSize: 16, margin: 0 }}>
            Choose a plan to continue finding recruiters and landing interviews.
          </p>
        </div>

        {/* Billing Period Toggle */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              borderRadius: 12,
              padding: 4,
              gap: 2,
            }}
          >
            {BILLING_PERIODS.map((period) => (
              <button
                key={period.id}
                onClick={() => setBillingPeriod(period.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: billingPeriod === period.id ? 600 : 400,
                  background:
                    billingPeriod === period.id ? "#fff" : "transparent",
                  color:
                    billingPeriod === period.id ? "#6B46C1" : "#64748b",
                  boxShadow:
                    billingPeriod === period.id
                      ? "0 1px 3px rgba(0,0,0,0.1)"
                      : "none",
                  transition: "all 0.15s",
                }}
              >
                {period.label}
                {period.tag && (
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 11,
                      color:
                        billingPeriod === period.id
                          ? "#7C3AED"
                          : "#94a3b8",
                    }}
                  >
                    ({period.tag})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plan Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {PLANS.map((plan) => {
            const pricing = getPlanPrice(plan.id, billingPeriod);
            const isPopular = plan.popular;
            const redirecting = isRedirecting === plan.id;

            return (
              <div
                key={plan.id}
                style={{
                  border: isPopular
                    ? "2px solid #6B46C1"
                    : "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: "28px 24px 24px",
                  position: "relative",
                  background: "#fff",
                }}
              >
                {isPopular && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#6B46C1",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 14px",
                      borderRadius: 20,
                      letterSpacing: "0.05em",
                    }}
                  >
                    MOST POPULAR
                  </div>
                )}

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    color: isPopular ? "#6B46C1" : "#6b7280",
                    marginBottom: 8,
                  }}
                >
                  {plan.name}
                </div>

                <div style={{ marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: "#1a1a2e",
                    }}
                  >
                    ${pricing.perMonth}
                  </span>
                  <span style={{ color: "#9ca3af", fontSize: 14 }}>/mo</span>
                </div>

                {pricing.savings > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#059669",
                      fontWeight: 500,
                      marginBottom: 8,
                    }}
                  >
                    Save ${pricing.savings} ({selectedPeriod.tag})
                  </div>
                )}

                <p
                  style={{
                    color: "#6b7280",
                    fontSize: 13,
                    margin: "0 0 16px",
                    lineHeight: 1.5,
                  }}
                >
                  {plan.tagline}
                </p>

                {plan.highlight && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 12,
                      fontWeight: 600,
                      fontSize: 14,
                      color: "#1a1a2e",
                    }}
                  >
                    <Sparkles
                      style={{ width: 16, height: 16, color: "#7C3AED" }}
                    />
                    {plan.highlight}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {plan.features.map((f) => (
                    <div
                      key={f}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: "#4b5563",
                      }}
                    >
                      <Check
                        style={{
                          width: 16,
                          height: 16,
                          color: "#7C3AED",
                          flexShrink: 0,
                        }}
                      />
                      {f}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={!!isRedirecting}
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    borderRadius: 10,
                    border: isPopular ? "none" : "1px solid #e5e7eb",
                    background: isPopular
                      ? "linear-gradient(135deg, #7C3AED, #6B46C1)"
                      : "#f9fafb",
                    color: isPopular ? "#fff" : "#4b5563",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isRedirecting ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: isRedirecting && !redirecting ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {redirecting ? (
                    "Redirecting..."
                  ) : (
                    <>
                      Get Started <ArrowRight style={{ width: 14, height: 14 }} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust signals */}
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#9ca3af",
            margin: "0 0 20px",
          }}
        >
          Cancel anytime &middot; No hidden fees &middot; 7-day money-back
          guarantee
        </p>

        {/* Logout */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={onLogout}
            style={{
              background: "none",
              border: "none",
              color: "#9ca3af",
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
