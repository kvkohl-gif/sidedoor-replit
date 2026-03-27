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
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
    not_contacted: { bg: "bg-gray-100", text: "text-gray-600", label: "Not Contacted" },
    email_sent: { bg: "bg-blue-50", text: "text-blue-700", label: "Email Sent" },
    linkedin_sent: { bg: "bg-blue-50", text: "text-blue-700", label: "LinkedIn Sent" },
    awaiting_reply: { bg: "bg-amber-50", text: "text-amber-700", label: "Awaiting Reply" },
    follow_up_needed: { bg: "bg-orange-50", text: "text-orange-700", label: "Follow-up" },
    replied: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Replied" },
    interview_scheduled: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Interview" },
  };
  const c = config[status] || config.not_contacted;
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.text} uppercase tracking-wide`}>
      {c.label}
    </span>
  );
}

// ── Checklist items for Getting Started ──────────────────────────────
const CHECKLIST_ITEMS = [
  { key: "account_created", label: "Created your account", page: "" },
  { key: "first_search", label: "Run your first search", page: "search" },
  { key: "first_contact_viewed", label: "View a contact", page: "contacts" },
  { key: "bio_added", label: "Add a short bio", page: "outreach-profile" },
  { key: "resume_uploaded", label: "Upload your resume", page: "outreach-profile" },
  { key: "first_message_generated", label: "Generate your first message", page: "" },
];

// ── Component ────────────────────────────────────────────────────────
export function Dashboard({ onNavigate }: DashboardProps) {
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);

  // Data fetching
  const { data: submissions = [], isLoading: loadingSub } = useQuery<any[]>({
    queryKey: ["/api/submissions"],
  });
  const { data: allContacts = [], isLoading: loadingContacts } = useQuery<any[]>({
    queryKey: ["/api/contacts/all"],
  });
  const { data: profile } = useQuery<any>({
    queryKey: ["/api/outreach-profile"],
  });
  const { data: userData } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { checklist, completionPercent, isComplete: onboardingComplete, isLoading: onboardingLoading } = useOnboarding();

  const isLoading = loadingSub || loadingContacts;
  const firstName = userData?.first_name || "";

  // ── Metric calculations ────────────────────────────────────────────
  const metrics = useMemo(() => {
    const contactsThisWeek = allContacts.filter(
      (c: any) => c.createdAt && isWithinDays(c.createdAt, 7)
    ).length;
    const emailsDrafted = allContacts.filter((c: any) => c.generatedEmailMessage).length;
    const activeJobs = submissions.filter((s: any) => !s.isArchived).length;
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
        onClick: () => onNavigate("contact-detail", { contactId: first.id }),
      });
    }

    // Stale awaiting contacts
    if (needFollowUp.length === 0) {
      const staleAwaiting = allContacts.filter(
        (c: any) =>
          (c.contactStatus === "awaiting_reply" || c.contactStatus === "follow_up_needed") &&
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
      (c: any) => c.generatedEmailMessage && c.contactStatus === "not_contacted"
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
      subtext: string;
      type: "submission" | "contact" | "draft";
    }> = [];

    for (const sub of submissions) {
      if (sub.submittedAt || sub.createdAt) {
        items.push({
          id: `sub-${sub.id}`,
          date: sub.submittedAt || sub.createdAt,
          text: `Added ${sub.jobTitle || "a position"} at ${sub.companyName || "a company"}`,
          subtext: "Added to your Job History tracking.",
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
          subtext: c.email ? "Verified contact email and LinkedIn profile." : "Lead identified via deep search algorithm.",
          type: "contact",
        });
      }
      if (c.generatedEmailMessage && c.createdAt) {
        items.push({
          id: `draft-${c.id}`,
          date: c.createdAt,
          text: `Drafted message for ${c.name || "a contact"}`,
          subtext: "Found matching expertise for your saved search.",
          type: "draft",
        });
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      .sort((a: any, b: any) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [submissions]);

  // ── Checklist state ────────────────────────────────────────────────
  const completedCount = CHECKLIST_ITEMS.filter((item) => checklist[item.key]).length;
  const showChecklist = !onboardingLoading && !onboardingComplete;

  // ── Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-full">
      <div className="max-w-[1200px] mx-auto">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Your Outreach Pipeline
          </h1>
          <p className="text-gray-500 text-[15px] mt-1">
            {firstName
              ? `Welcome back, ${firstName}. `
              : ""}
            Track your progress from contact discovery to interview.
          </p>
        </div>

        {/* ── 1. Metric Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Contacts this week",
              value: metrics.contactsThisWeek,
              icon: Users,
              iconBg: "bg-purple-100",
              iconColor: "text-purple-600",
              cardBg: "bg-white",
              page: "contacts",
            },
            {
              label: "Emails drafted",
              value: metrics.emailsDrafted,
              icon: Mail,
              iconBg: "bg-blue-100",
              iconColor: "text-blue-600",
              cardBg: "bg-white",
              page: "contacts",
            },
            {
              label: "Active jobs",
              value: metrics.activeJobs,
              icon: Briefcase,
              iconBg: "bg-emerald-100",
              iconColor: "text-emerald-600",
              cardBg: "bg-white",
              page: "job-history",
            },
            {
              label: "Profile strength",
              value: `${metrics.profileStrength}%`,
              icon: UserCheck,
              iconBg: "bg-rose-100",
              iconColor: "text-rose-600",
              cardBg: "bg-white",
              page: "outreach-profile",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                onClick={() => onNavigate(card.page)}
                className={`${card.cardBg} border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all text-left group`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.iconBg}`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <div className="text-2xl font-bold text-gray-900 leading-none mb-1">
                  {card.value}
                </div>
                <div className="text-[13px] text-gray-500">{card.label}</div>
              </button>
            );
          })}
        </div>

        {/* ── 2. Middle Row: Profile / Checklist + Recommendations ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          {/* Left: Profile Completion / Getting Started */}
          <div className="lg:col-span-3">
            {showChecklist ? (
              /* Getting Started Checklist */
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm h-full">
                <button
                  onClick={() => setChecklistCollapsed(!checklistCollapsed)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                      {completedCount}/{CHECKLIST_ITEMS.length}
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-gray-900">Getting Started</h2>
                      <p className="text-xs text-gray-500">Complete your setup</p>
                    </div>
                  </div>
                  {checklistCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {/* Progress bar */}
                <div className="px-5 pb-3">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-500"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>

                {/* Checklist items */}
                {!checklistCollapsed && (
                  <div className="px-5 pb-5 space-y-1">
                    {CHECKLIST_ITEMS.map((item) => {
                      const done = checklist[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            if (!done && item.page) onNavigate(item.page);
                          }}
                          disabled={done || !item.page}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                            done
                              ? "text-gray-400 cursor-default"
                              : "text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${
                                done
                                  ? "bg-purple-600 text-white"
                                  : "border-2 border-gray-300"
                              }`}
                            >
                              {done && <Check className="w-3 h-3" />}
                            </div>
                            <span className={done ? "line-through" : ""}>{item.label}</span>
                          </div>
                          {!done && item.page && (
                            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Profile Completion Card (shown after onboarding) */
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 h-full">
                <div className="flex items-start gap-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <h2 className="text-[15px] font-semibold text-gray-900">
                        Complete your outreach profile
                      </h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                      Our AI needs more context to generate high-conversion messages. Upload your resume
                      or fill in your background to unlock tailored outreach.
                    </p>
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Profile Status
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {metrics.profileStrength}% Completed
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full mb-4">
                      <div
                        className="h-full bg-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${metrics.profileStrength}%` }}
                      />
                    </div>
                    <button
                      onClick={() => onNavigate("outreach-profile")}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      Edit profile
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: AI Recommendations / Suggested Next Steps */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm h-full flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h2 className="text-[15px] font-semibold text-gray-900">AI Recommendations</h2>
            </div>

            {suggestions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
                <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">You're all caught up!</p>
                <p className="text-xs text-gray-500 mb-4 text-center">Start a new search to discover more contacts</p>
                <button
                  onClick={() => onNavigate("search")}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 inline-flex items-center gap-1"
                >
                  New search
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 divide-y divide-gray-100">
                {suggestions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={item.onClick}
                      className="w-full flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left group"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${item.iconBg}`}>
                        <Icon className={`w-4 h-4 ${item.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 mb-0.5">{item.title}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{item.subtitle}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Bottom Row: Activity Feed + Active Jobs ──────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Recent Activity (takes 3/5 on desktop) */}
          <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-900">Recent Activity</h2>
              {timeline.length > 10 && (
                <button
                  onClick={() => onNavigate("contacts")}
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {groupedTimeline.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">No activity yet</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Paste a job posting to start finding contacts
                </p>
                <button
                  onClick={() => onNavigate("search")}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2 text-sm font-medium"
                >
                  <Search className="w-4 h-4" />
                  Start New Search
                </button>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <div className="px-5 py-3 space-y-4">
                  {groupedTimeline.map((group) => (
                    <div key={group.label}>
                      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {group.label}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const dotColor =
                            item.type === "submission"
                              ? "bg-indigo-500"
                              : item.type === "contact"
                              ? "bg-purple-500"
                              : "bg-blue-500";
                          return (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex-shrink-0 mt-1.5">
                                <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800 font-medium leading-snug truncate">
                                  {item.text}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5 truncate">
                                  {item.subtext}
                                </p>
                              </div>
                              <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5 tabular-nums">
                                {formatTime(item.date)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Jobs (takes 2/5 on desktop) */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-900">Active Jobs</h2>
              {submissions.length > 5 && (
                <button
                  onClick={() => onNavigate("job-history")}
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {activeJobs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Briefcase className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">No active jobs</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Search for a job to get started
                </p>
                <button
                  onClick={() => onNavigate("search")}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 inline-flex items-center gap-1"
                >
                  New search
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="divide-y divide-gray-100 flex-1 max-h-[360px] overflow-y-auto">
                  {activeJobs.map((job: any) => {
                    const contactCount = job.recruiters?.length ?? 0;
                    const mostRecentStatus = job.recruiters?.[0]?.contactStatus || "not_contacted";
                    return (
                      <button
                        key={job.id}
                        onClick={() => onNavigate("job-details", { submissionId: job.id })}
                        className="w-full px-5 py-4 hover:bg-gray-50 transition-colors text-left group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">
                              {(job.companyName || "?")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {job.jobTitle || "Untitled Position"}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {job.companyName || "Unknown Company"}
                                {(job.submittedAt || job.createdAt) && (
                                  <span className="text-gray-400"> · {timeAgo(job.submittedAt || job.createdAt)}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={mostRecentStatus} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {submissions.filter((s: any) => !s.isArchived).length > 5 && (
                  <div className="px-5 py-3 border-t border-gray-100">
                    <button
                      onClick={() => onNavigate("job-history")}
                      className="w-full text-center text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                    >
                      Explore all active roles
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
