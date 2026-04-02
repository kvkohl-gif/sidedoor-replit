import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Mail,
  Briefcase,
  UserCheck,
  Search,
  Loader2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
  TrendingUp,
  Sparkles,
  Target,
  Clock,
} from "lucide-react";
import { useOnboarding } from "../hooks/useOnboarding";
import { usePlanAccess } from "../hooks/usePlanAccess";
import { TrialWarningBanner, PastDueBanner, CreditsExhaustedBanner } from "./BillingBanners";

interface DashboardProps {
  onNavigate: (page: string, data?: any) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────
function isWithinDays(dateStr: string, days: number): boolean {
  return Date.now() - new Date(dateStr).getTime() <= days * 86_400_000;
}

function olderThanDays(dateStr: string, days: number): boolean {
  return Date.now() - new Date(dateStr).getTime() > days * 86_400_000;
}

function formatRelativeDay(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round(
    (today.getTime() - target.getTime()) / 86_400_000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const SENT_STATUSES = new Set([
  "email_sent",
  "linkedin_sent",
  "awaiting_reply",
  "follow_up_needed",
  "replied",
  "interview_scheduled",
]);

// Status badge for jobs
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    not_contacted: {
      bg: "bg-gray-100",
      text: "text-gray-600",
      label: "Not Started",
    },
    email_sent: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      label: "Email Sent",
    },
    linkedin_sent: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      label: "LinkedIn Sent",
    },
    awaiting_reply: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      label: "Awaiting Reply",
    },
    follow_up_needed: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      label: "Follow-up",
    },
    replied: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      label: "Replied",
    },
    interview_scheduled: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      label: "Interview",
    },
  };
  const c = config[status] || config.not_contacted;
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

// ── Checklist items for Getting Started ──────────────────────────────
const CHECKLIST_ITEMS = [
  { key: "account_created", label: "Created your account", page: "" },
  { key: "first_search", label: "Run your first search", page: "search" },
  {
    key: "first_contact_viewed",
    label: "View a contact",
    page: "contacts",
  },
  { key: "bio_added", label: "Add a short bio", page: "outreach-profile" },
  {
    key: "resume_uploaded",
    label: "Upload your resume",
    page: "outreach-profile",
  },
  {
    key: "first_message_generated",
    label: "Generate your first message",
    page: "",
  },
];

// ── Component ────────────────────────────────────────────────────────
function DashboardBanners({ onNavigate }: { onNavigate: (page: string, data?: any) => void }) {
  const { trialWarning, trialDaysLeft, isPastDue, creditsExhausted, billingCycleEnd, planName } = usePlanAccess();

  return (
    <>
      {isPastDue && <PastDueBanner onNavigate={onNavigate} />}
      {trialWarning && trialDaysLeft !== null && (
        <TrialWarningBanner daysLeft={trialDaysLeft} onNavigate={onNavigate} />
      )}
      {creditsExhausted && !isPastDue && (
        <CreditsExhaustedBanner billingCycleEnd={billingCycleEnd} planName={planName} onNavigate={onNavigate} />
      )}
    </>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);

  // Data fetching
  const { data: submissions = [], isLoading: loadingSub } = useQuery<any[]>({
    queryKey: ["/api/submissions"],
  });
  const { data: allContacts = [], isLoading: loadingContacts } = useQuery<
    any[]
  >({
    queryKey: ["/api/contacts/all"],
  });
  const { data: profile } = useQuery<any>({
    queryKey: ["/api/outreach-profile"],
  });
  const { data: userData } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const {
    checklist,
    completionPercent,
    isComplete: onboardingComplete,
    isLoading: onboardingLoading,
  } = useOnboarding();

  const isLoading = loadingSub || loadingContacts;
  const firstName = userData?.first_name || "";

  // ── Metric calculations ────────────────────────────────────────────
  const metrics = useMemo(() => {
    const contactsThisWeek = allContacts.filter(
      (c: any) => c.createdAt && isWithinDays(c.createdAt, 7)
    ).length;
    const emailsDrafted = allContacts.filter(
      (c: any) => c.generatedEmailMessage
    ).length;
    const activeJobs = submissions.filter(
      (s: any) => !s.isArchived
    ).length;
    const profileStrength = profile?.profileCompleteness ?? 0;
    return { contactsThisWeek, emailsDrafted, activeJobs, profileStrength };
  }, [allContacts, submissions, profile]);

  // ── Suggested next steps (rule-based) ──────────────────────────────
  const suggestions = useMemo(() => {
    const items: Array<{
      id: string;
      icon: typeof Users;
      iconBg: string;
      iconColor: string;
      title: string;
      subtitle: string;
      onClick: () => void;
    }> = [];

    // 1. Contacts needing follow-up
    const needFollowUp = allContacts.filter(
      (c: any) =>
        SENT_STATUSES.has(c.contactStatus) &&
        !["replied", "interview_scheduled"].includes(c.contactStatus) &&
        c.lastContactedAt &&
        olderThanDays(c.lastContactedAt, 5)
    );
    if (needFollowUp.length > 0) {
      const first = needFollowUp[0];
      items.push({
        id: "follow-up",
        icon: Zap,
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        title: `Follow up with ${first.name || "a contact"}`,
        subtitle: `${first.companyName || ""}${first.lastContactedAt ? ` · Contacted ${timeAgo(first.lastContactedAt)}` : ""}`,
        onClick: () =>
          onNavigate("contact-detail", { contactId: first.id }),
      });
    }

    // Stale awaiting contacts
    if (needFollowUp.length === 0) {
      const staleAwaiting = allContacts.filter(
        (c: any) =>
          (c.contactStatus === "awaiting_reply" ||
            c.contactStatus === "follow_up_needed") &&
          c.createdAt &&
          olderThanDays(c.createdAt, 5)
      );
      if (staleAwaiting.length > 0) {
        items.push({
          id: "follow-up-stale",
          icon: Clock,
          iconBg: "bg-amber-50",
          iconColor: "text-amber-600",
          title: `${staleAwaiting.length} contact${staleAwaiting.length > 1 ? "s" : ""} awaiting reply`,
          subtitle: "Follow-ups boost reply rates by 22–49%",
          onClick: () => onNavigate("contacts"),
        });
      }
    }

    // 2. Unsent messages
    const unsentDrafts = allContacts.filter(
      (c: any) =>
        c.generatedEmailMessage && c.contactStatus === "not_contacted"
    );
    if (unsentDrafts.length > 0) {
      items.push({
        id: "unsent-messages",
        icon: Mail,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        title: `Review ${unsentDrafts.length} ready message${unsentDrafts.length > 1 ? "s" : ""}`,
        subtitle: `${unsentDrafts.length} draft${unsentDrafts.length > 1 ? "s" : ""} waiting to be sent`,
        onClick: () => onNavigate("contacts"),
      });
    }

    // 3. Profile incomplete
    const completeness = profile?.profileCompleteness ?? 0;
    if (completeness < 80) {
      items.push({
        id: "profile",
        icon: Target,
        iconBg: "bg-purple-50",
        iconColor: "text-purple-600",
        title: "Complete your outreach profile",
        subtitle: "Better messages with more context about you",
        onClick: () => onNavigate("outreach-profile"),
      });
    }

    // 4. New contacts not yet reviewed
    const recentUnreviewed = allContacts.filter(
      (c: any) =>
        c.contactStatus === "not_contacted" &&
        !c.generatedEmailMessage &&
        c.createdAt &&
        isWithinDays(c.createdAt, 7)
    );
    if (recentUnreviewed.length > 0 && items.length < 4) {
      items.push({
        id: "new-contacts",
        icon: Users,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        title: `${recentUnreviewed.length} new contact${recentUnreviewed.length > 1 ? "s" : ""} to review`,
        subtitle: "Generate messages to start outreach",
        onClick: () => onNavigate("contacts"),
      });
    }

    return items.slice(0, 4);
  }, [allContacts, profile, onNavigate]);

  // ── Activity timeline ──────────────────────────────────────────────
  const timeline = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      text: string;
      type: "submission" | "contact" | "draft";
    }> = [];

    for (const sub of submissions) {
      if (sub.submittedAt || sub.createdAt) {
        items.push({
          id: `sub-${sub.id}`,
          date: sub.submittedAt || sub.createdAt,
          text: `Added ${sub.jobTitle || "a position"} at ${sub.companyName || "a company"}`,
          type: "submission",
        });
      }
    }

    for (const c of allContacts) {
      if (c.createdAt) {
        items.push({
          id: `contact-${c.id}`,
          date: c.createdAt,
          text: `Found ${c.name || "a contact"}${c.title ? ` (${c.title})` : ""} at ${c.companyName || "a company"}`,
          type: "contact",
        });
      }
      if (c.generatedEmailMessage && c.createdAt) {
        items.push({
          id: `draft-${c.id}`,
          date: c.createdAt,
          text: `Drafted message for ${c.name || "a contact"}`,
          type: "draft",
        });
      }
    }

    items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return items.slice(0, 15);
  }, [submissions, allContacts]);

  const groupedTimeline = useMemo(() => {
    const groups: Array<{ label: string; items: typeof timeline }> = [];
    let currentLabel = "";
    for (const item of timeline) {
      const label = formatRelativeDay(item.date);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }, [timeline]);

  // ── Active jobs (non-archived, most recent 5) ─────────────────────
  const activeJobs = useMemo(() => {
    return submissions
      .filter((s: any) => !s.isArchived)
      .sort(
        (a: any, b: any) =>
          new Date(b.submittedAt || b.createdAt || 0).getTime() -
          new Date(a.submittedAt || a.createdAt || 0).getTime()
      )
      .slice(0, 5);
  }, [submissions]);

  // ── Checklist state ────────────────────────────────────────────────
  const completedCount = CHECKLIST_ITEMS.filter(
    (item) => checklist[item.key]
  ).length;
  const showChecklist = !onboardingLoading && !onboardingComplete;

  // ── Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 min-h-full" style={{ background: "#f9fafb" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* ─── Header ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#111827",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#6b7280",
              margin: "4px 0 0",
            }}
          >
            Here's what's happening with your outreach.
          </p>
        </div>

        {/* ─── Billing Banners ────────────────────────────────── */}
        <DashboardBanners onNavigate={onNavigate} />

        {/* ─── Metric Cards ── 4 columns ─────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[
            {
              label: "Contacts this week",
              value: metrics.contactsThisWeek,
              icon: Users,
              color: "#7c3aed",
              bg: "#f5f3ff",
              page: "contacts",
            },
            {
              label: "Emails drafted",
              value: metrics.emailsDrafted,
              icon: Mail,
              color: "#2563eb",
              bg: "#eff6ff",
              page: "contacts",
            },
            {
              label: "Active jobs",
              value: metrics.activeJobs,
              icon: Briefcase,
              color: "#059669",
              bg: "#ecfdf5",
              page: "job-history",
            },
            {
              label: "Profile strength",
              value: `${metrics.profileStrength}%`,
              icon: UserCheck,
              color: "#e11d48",
              bg: "#fff1f2",
              page: "outreach-profile",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                onClick={() => onNavigate(card.page)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "20px 16px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "box-shadow 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: card.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Icon
                    style={{ width: 18, height: 18, color: card.color }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#111827",
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {card.value}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {card.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* ─── Middle Row: Left (Checklist/Profile) + Right (Suggestions) ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* LEFT: Getting Started / Profile Completion */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {showChecklist ? (
              <>
                {/* Collapsible header */}
                <button
                  onClick={() => setChecklistCollapsed(!checklistCollapsed)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
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
                        background: "#f5f3ff",
                        color: "#7c3aed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {completedCount}/{CHECKLIST_ITEMS.length}
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        Getting Started
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        Complete your setup to get the most out of SideDoor
                      </div>
                    </div>
                  </div>
                  {checklistCollapsed ? (
                    <ChevronDown
                      style={{ width: 16, height: 16, color: "#9ca3af" }}
                    />
                  ) : (
                    <ChevronUp
                      style={{ width: 16, height: 16, color: "#9ca3af" }}
                    />
                  )}
                </button>

                {/* Progress bar */}
                <div style={{ padding: "0 20px 12px" }}>
                  <div
                    style={{
                      height: 6,
                      background: "#f3f4f6",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${completionPercent}%`,
                        background: "#7c3aed",
                        borderRadius: 999,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Checklist items */}
                {!checklistCollapsed && (
                  <div style={{ padding: "0 20px 16px" }}>
                    {CHECKLIST_ITEMS.map((item) => {
                      const done = checklist[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            if (!done && item.page) onNavigate(item.page);
                          }}
                          disabled={done || !item.page}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "none",
                            background: "transparent",
                            cursor: done || !item.page ? "default" : "pointer",
                            textAlign: "left",
                            fontSize: 14,
                            color: done ? "#9ca3af" : "#374151",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            if (!done && item.page)
                              e.currentTarget.style.background = "#f5f3ff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                ...(done
                                  ? {
                                      background: "#7c3aed",
                                      color: "#fff",
                                    }
                                  : {
                                      border: "2px solid #d1d5db",
                                      background: "#fff",
                                    }),
                              }}
                            >
                              {done && (
                                <Check
                                  style={{ width: 12, height: 12 }}
                                />
                              )}
                            </div>
                            <span
                              style={{
                                textDecoration: done
                                  ? "line-through"
                                  : "none",
                              }}
                            >
                              {item.label}
                            </span>
                          </div>
                          {!done && item.page && (
                            <ArrowRight
                              style={{
                                width: 14,
                                height: 14,
                                color: "#9ca3af",
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Profile Completion Card (shown after onboarding complete) */
              <div style={{ padding: 24 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <Sparkles
                    style={{ width: 18, height: 18, color: "#7c3aed" }}
                  />
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    Complete your outreach profile
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#7c3aed",
                    }}
                  >
                    {metrics.profileStrength}%
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    margin: "0 0 16px",
                    lineHeight: 1.5,
                  }}
                >
                  Your profile is {metrics.profileStrength}% complete. A
                  stronger profile generates better AI messages.
                </p>
                <div
                  style={{
                    height: 6,
                    background: "#f3f4f6",
                    borderRadius: 999,
                    overflow: "hidden",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${metrics.profileStrength}%`,
                      background: "#7c3aed",
                      borderRadius: 999,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                <button
                  onClick={() => onNavigate("outreach-profile")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#7c3aed",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Edit profile
                  <ArrowRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Suggested Next Steps */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #f3f4f6",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Sparkles
                style={{ width: 16, height: 16, color: "#7c3aed" }}
              />
              <span
                style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}
              >
                Suggested Next Steps
              </span>
            </div>

            {suggestions.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "32px 20px",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#f5f3ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <TrendingUp
                    style={{ width: 24, height: 24, color: "#a78bfa" }}
                  />
                </div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#111827",
                    marginBottom: 4,
                  }}
                >
                  You're all caught up!
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginBottom: 16,
                    textAlign: "center",
                  }}
                >
                  Start a new search to discover more contacts
                </p>
                <button
                  onClick={() => onNavigate("search")}
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#7c3aed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  New search
                  <ArrowRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                {suggestions.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={item.onClick}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "14px 20px",
                        background: "transparent",
                        border: "none",
                        borderBottom:
                          idx < suggestions.length - 1
                            ? "1px solid #f3f4f6"
                            : "none",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: item.iconBg
                            .replace("bg-amber-50", "#fffbeb")
                            .replace("bg-blue-50", "#eff6ff")
                            .replace("bg-purple-50", "#f5f3ff")
                            .replace("bg-emerald-50", "#ecfdf5"),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        <Icon
                          style={{
                            width: 16,
                            height: 16,
                            color: item.iconColor
                              .replace("text-amber-600", "#d97706")
                              .replace("text-blue-600", "#2563eb")
                              .replace("text-purple-600", "#7c3aed")
                              .replace("text-emerald-600", "#059669"),
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#111827",
                            margin: "0 0 2px",
                          }}
                        >
                          {item.title}
                        </p>
                        <p
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            margin: 0,
                          }}
                        >
                          {item.subtitle}
                        </p>
                      </div>
                      <ArrowRight
                        style={{
                          width: 16,
                          height: 16,
                          color: "#d1d5db",
                          flexShrink: 0,
                          marginTop: 4,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── Bottom Row: Activity Feed + Active Jobs ──────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 2fr",
            gap: 16,
          }}
        >
          {/* Recent Activity */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}
              >
                Recent Activity
              </span>
              {timeline.length > 10 && (
                <button
                  onClick={() => onNavigate("contacts")}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#7c3aed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  View all
                  <ArrowRight style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>

            {groupedTimeline.length === 0 ? (
              <div
                style={{
                  padding: "48px 20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                  }}
                >
                  <Search
                    style={{ width: 24, height: 24, color: "#9ca3af" }}
                  />
                </div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#111827",
                    marginBottom: 4,
                  }}
                >
                  No activity yet
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginBottom: 16,
                  }}
                >
                  Paste a job posting to start finding contacts
                </p>
                <button
                  onClick={() => onNavigate("search")}
                  style={{
                    padding: "8px 16px",
                    background: "#7c3aed",
                    color: "#fff",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Search style={{ width: 16, height: 16 }} />
                  Start New Search
                </button>
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <div style={{ padding: "12px 20px" }}>
                  {groupedTimeline.map((group) => (
                    <div key={group.label} style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#9ca3af",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: 8,
                        }}
                      >
                        {group.label}
                      </div>
                      {group.items.map((item) => {
                        const dotColor =
                          item.type === "submission"
                            ? "#6366f1"
                            : item.type === "contact"
                              ? "#8b5cf6"
                              : "#3b82f6";
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 12,
                              padding: "8px 0",
                            }}
                          >
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: dotColor,
                                flexShrink: 0,
                                marginTop: 6,
                              }}
                            />
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 14,
                                color: "#374151",
                                lineHeight: 1.4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.text}
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                                flexShrink: 0,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {formatTime(item.date)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Jobs */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}
              >
                Active Jobs
              </span>
              {submissions.length > 5 && (
                <button
                  onClick={() => onNavigate("job-history")}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#7c3aed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  View all
                  <ArrowRight style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>

            {activeJobs.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "48px 20px",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Briefcase
                    style={{ width: 24, height: 24, color: "#9ca3af" }}
                  />
                </div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#111827",
                    marginBottom: 4,
                  }}
                >
                  No active jobs
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginBottom: 16,
                  }}
                >
                  Search for a job to get started
                </p>
                <button
                  onClick={() => onNavigate("search")}
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#7c3aed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  New search
                  <ArrowRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    flex: 1,
                    maxHeight: 360,
                    overflowY: "auto",
                  }}
                >
                  {activeJobs.map((job: any, idx: number) => {
                    const mostRecentStatus =
                      job.recruiters?.[0]?.contactStatus || "not_contacted";
                    return (
                      <button
                        key={job.id}
                        onClick={() =>
                          onNavigate("job-details", {
                            submissionId: job.id,
                          })
                        }
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "14px 20px",
                          background: "transparent",
                          border: "none",
                          borderBottom:
                            idx < activeJobs.length - 1
                              ? "1px solid #f3f4f6"
                              : "none",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f9fafb";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: "#f3f4f6",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#6b7280",
                            }}
                          >
                            {(job.companyName || "?")[0].toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: "#111827",
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {job.jobTitle || "Untitled Position"}
                            </p>
                            <p
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                margin: "2px 0 0",
                              }}
                            >
                              {job.companyName || "Unknown Company"}
                              {(job.submittedAt || job.createdAt) && (
                                <span style={{ color: "#9ca3af" }}>
                                  {" "}
                                  ·{" "}
                                  {timeAgo(
                                    job.submittedAt || job.createdAt
                                  )}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={mostRecentStatus} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
