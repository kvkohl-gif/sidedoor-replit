import React from "react";
import { Lock } from "lucide-react";
import { usePlanAccess } from "../hooks/usePlanAccess";

const VALUE_PROPS: Record<string, string> = {
  bio: "Let AI personalize your outreach with your professional story",
  achievements: "Highlight your wins to stand out to recruiters",
  goals: "Target your outreach to the right opportunities",
  voice: "Control the tone and style of AI-generated messages",
  hooks: "Create personal connections that get responses",
  hobbies: "Share interests that build rapport with recruiters",
  portfolio: "Trigger our highest-converting email template by attaching work samples",
  mutual: "Warm intros are the #1 email format — list them once, the AI uses them automatically",
  outreachHub: "Track your full outreach pipeline and follow-ups",
  followUpDrafts: "AI-powered follow-up sequences to stay top of mind",
  linkedinDrafts: "Craft LinkedIn messages that get accepted",
  redraft: "Try a different tone to find what works best",
  bulkExport: "Export contacts in bulk for external tools",
};

/* ---------- FeatureLockBadge ---------- */

interface FeatureLockBadgeProps {
  feature: string;
  requiredPlan: "pro" | "max";
}

export function FeatureLockBadge({ feature, requiredPlan }: FeatureLockBadgeProps) {
  const [hovered, setHovered] = React.useState(false);
  const planLabel = requiredPlan === "max" ? "Max" : "Pro";

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Lock size={14} style={{ color: "#9CA3AF" }} />

      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "10px 14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            whiteSpace: "nowrap",
            zIndex: 50,
            minWidth: 200,
          }}
        >
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>
            {VALUE_PROPS[feature] ?? "Upgrade to unlock this feature"}
          </div>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#7C3AED",
              textDecoration: "none",
            }}
          >
            Upgrade to {planLabel} &rarr;
          </a>
        </div>
      )}
    </span>
  );
}

/* ---------- FeatureLockOverlay ---------- */

interface FeatureLockOverlayProps {
  feature: string;
  requiredPlan: "pro" | "max";
  children: React.ReactNode;
  onUpgrade: () => void;
}

export function FeatureLockOverlay({
  feature,
  requiredPlan,
  children,
  onUpgrade,
}: FeatureLockOverlayProps) {
  const [showCard, setShowCard] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const planLabel = requiredPlan === "max" ? "Max" : "Pro";

  // Dismiss on click outside
  React.useEffect(() => {
    if (!showCard) return;

    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowCard(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCard]);

  // Dismiss on Escape
  React.useEffect(() => {
    if (!showCard) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowCard(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showCard]);

  const handleInterceptClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setShowCard(true);
    },
    []
  );

  return (
    <div style={{ position: "relative" }}>
      {/* Children render fully visible */}
      {children}

      {/* Transparent click interceptor */}
      <div
        onClick={handleInterceptClick}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          cursor: "pointer",
        }}
      />

      {/* Inline upgrade card */}
      {showCard && (
        <div
          ref={cardRef}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "#fff",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            padding: "20px 24px",
            maxWidth: 320,
            width: "90%",
            zIndex: 20,
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Lock size={24} style={{ color: "#7C3AED" }} />
          </div>
          <div style={{ fontSize: 14, color: "#374151", marginBottom: 16, lineHeight: 1.5 }}>
            {VALUE_PROPS[feature] ?? "Upgrade to unlock this feature"}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpgrade();
            }}
            style={{
              backgroundColor: "#7C3AED",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Upgrade to {planLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- useFeatureGate ---------- */

const PROFILE_SECTIONS = ["bio", "achievements", "goals", "voice", "hooks", "portfolio", "mutual", "hobbies"];

export function useFeatureGate(feature: string): {
  isLocked: boolean;
  requiredPlan: "pro" | "max";
} {
  const {
    canAccessProfileSection,
    canAccessOutreachHub,
    canFollowUp,
    canLinkedinDraft,
    canRedraft,
    canBulkExport,
    requiredPlanFor,
  } = usePlanAccess();

  let isLocked = false;

  if (PROFILE_SECTIONS.includes(feature)) {
    isLocked = !canAccessProfileSection(feature);
  } else if (feature === "outreachHub") {
    isLocked = !canAccessOutreachHub;
  } else if (feature === "followUpDrafts") {
    isLocked = !canFollowUp;
  } else if (feature === "linkedinDrafts") {
    isLocked = !canLinkedinDraft;
  } else if (feature === "redraft") {
    isLocked = !canRedraft;
  } else if (feature === "bulkExport") {
    isLocked = !canBulkExport;
  }

  return {
    isLocked,
    requiredPlan: requiredPlanFor(feature),
  };
}
