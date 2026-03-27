import { usePlanAccess } from "../hooks/usePlanAccess";
import { Lock, Zap } from "lucide-react";

interface UpgradeGateProps {
  /** What this gate protects: "search", "message", "email" */
  feature: "search" | "message" | "email";
  /** Render children when access is allowed */
  children: React.ReactNode;
  /** Navigate to billing page */
  onNavigate: (page: string) => void;
}

const FEATURE_MESSAGES: Record<string, { title: string; description: string }> = {
  search: {
    title: "Upgrade to search for contacts",
    description: "You've used all your search credits. Upgrade your plan to continue finding contacts.",
  },
  message: {
    title: "Upgrade to generate messages",
    description: "AI message generation requires credits. Upgrade to create personalized outreach.",
  },
  email: {
    title: "Upgrade to view emails",
    description: "Email addresses are available on paid plans. Upgrade to see full contact details.",
  },
};

export function UpgradeGate({ feature, children, onNavigate }: UpgradeGateProps) {
  const { canSearch, canGenerateMessage, canViewEmail, trialExpired, isFreeTier, creditBalance } = usePlanAccess();

  let allowed = true;
  if (feature === "search") allowed = canSearch;
  else if (feature === "message") allowed = canGenerateMessage;
  else if (feature === "email") allowed = canViewEmail;

  if (allowed) {
    return <>{children}</>;
  }

  const msg = FEATURE_MESSAGES[feature];

  return (
    <div className="relative">
      {/* Blurred content behind */}
      <div className="blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>

      {/* Overlay prompt */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-white rounded-xl shadow-lg border border-[#E2E8F0] p-6 max-w-sm mx-4 text-center">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-[#6B46C1]" />
          </div>
          <h3 className="text-[#0F172A] font-semibold mb-2">{msg.title}</h3>
          <p className="text-sm text-[#64748B] mb-4">{msg.description}</p>
          {trialExpired && (
            <p className="text-xs text-red-500 mb-3">Your free trial has expired.</p>
          )}
          {!trialExpired && isFreeTier && creditBalance === 0 && (
            <p className="text-xs text-amber-600 mb-3">You have 0 credits remaining.</p>
          )}
          <button
            onClick={() => onNavigate("billing")}
            className="w-full py-2.5 px-4 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Mask an email address for free-tier users with no credits.
 * Shows first 2 chars + ***@domain
 */
export function maskEmail(email: string, canView: boolean): string {
  if (canView) return email;
  const [local, domain] = email.split("@");
  if (!domain) return "••••@••••.com";
  const visible = local.slice(0, 2);
  return `${visible}•••@${domain}`;
}
