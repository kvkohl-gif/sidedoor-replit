import { useState } from "react";
import { AlertTriangle, Clock, CreditCard, X, ArrowRight } from "lucide-react";

interface TrialWarningBannerProps {
  daysLeft: number;
  onNavigate: (page: string) => void;
}

export function TrialWarningBanner({ daysLeft, onNavigate }: TrialWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
        border: "1px solid #F59E0B",
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Clock style={{ width: 20, height: 20, color: "#D97706", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, color: "#92400E", fontSize: 14 }}>
          Your free trial ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}.
        </span>
        <span style={{ color: "#A16207", fontSize: 14, marginLeft: 4 }}>
          Choose a plan to keep your outreach pipeline running.
        </span>
      </div>
      <button
        onClick={() => onNavigate("billing")}
        style={{
          background: "#D97706",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        Choose Plan <ArrowRight style={{ width: 14, height: 14 }} />
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          color: "#A16207",
          flexShrink: 0,
        }}
      >
        <X style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}

interface PastDueBannerProps {
  onNavigate: (page: string) => void;
}

export function PastDueBanner({ onNavigate }: PastDueBannerProps) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #FEE2E2, #FECACA)",
        border: "1px solid #EF4444",
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <AlertTriangle style={{ width: 20, height: 20, color: "#DC2626", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, color: "#991B1B", fontSize: 14 }}>
          Payment failed.
        </span>
        <span style={{ color: "#B91C1C", fontSize: 14, marginLeft: 4 }}>
          Update your payment method to avoid losing access to your account.
        </span>
      </div>
      <button
        onClick={() => onNavigate("billing")}
        style={{
          background: "#DC2626",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        <CreditCard style={{ width: 14, height: 14 }} />
        Update Payment
      </button>
    </div>
  );
}

interface CreditsExhaustedBannerProps {
  billingCycleEnd: string | null;
  planName: string;
  onNavigate: (page: string) => void;
}

export function CreditsExhaustedBanner({ billingCycleEnd, planName, onNavigate }: CreditsExhaustedBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const resetDate = billingCycleEnd
    ? new Date(billingCycleEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "your next billing cycle";

  const nextPlan = planName === "starter" ? "Professional" : planName === "pro" ? "Executive" : null;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #EDE9FE, #DDD6FE)",
        border: "1px solid #8B5CF6",
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <CreditCard style={{ width: 20, height: 20, color: "#7C3AED", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, color: "#5B21B6", fontSize: 14 }}>
          Credits exhausted.
        </span>
        <span style={{ color: "#6D28D9", fontSize: 14, marginLeft: 4 }}>
          Your credits reset on {resetDate}.
          {nextPlan && ` Need more? Upgrade to ${nextPlan} for additional credits.`}
        </span>
      </div>
      {nextPlan && (
        <button
          onClick={() => onNavigate("billing")}
          style={{
            background: "#7C3AED",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          Upgrade <ArrowRight style={{ width: 14, height: 14 }} />
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          color: "#6D28D9",
          flexShrink: 0,
        }}
      >
        <X style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}
