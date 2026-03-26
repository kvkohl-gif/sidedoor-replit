import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  FileText,
  Send,
  Clock,
  MessageSquare,
  Calendar,
  Search,
  Briefcase,
  UserCheck,
  Zap,
  ArrowRight,
  ChevronRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Target,
} from "lucide-react";

interface DashboardProps {
  onNavigate: (page: string, data?: any) => void;
}

// ── Pipeline stage definition ────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: "found",    label: "Found",       icon: Users,          color: "#6B46C1" },
  { key: "drafted",  label: "Drafted",     icon: FileText,       color: "#7C3AED" },
  { key: "sent",     label: "Sent",        icon: Send,           color: "#8B5CF6" },
  { key: "awaiting", label: "Awaiting",    icon: Clock,          color: "#A78BFA" },
  { key: "replied",  label: "Replied",     icon: MessageSquare,  color: "#059669" },
  { key: "interviews", label: "Interviews", icon: Calendar,      color: "#10B981" },
] as const;

const SENT_STATUSES = new Set([
  "email_sent", "linkedin_sent", "awaiting_reply",
  "follow_up_needed", "replied", "interview_scheduled",
]);
const AWAITING_STATUSES = new Set(["awaiting_reply", "follow_up_needed"]);

// ── Helpers ──────────────────────────────────────────────────────────
function isWithinDays(dateStr: string, days: number): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return now.getTime() - d.getTime() <= days * 86_400_000;
}

function olderThanDays(dateStr: string, days: number): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return now.getTime() - d.getTime() > days * 86_400_000;
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

// ── Component ────────────────────────────────────────────────────────
export function Dashboard({ onNavigate }: DashboardProps) {
  // Data fetching
  const { data: submissions = [], isLoading: loadingSub } = useQuery<any[]>({
    queryKey: ["/api/submissions"],
  });
  const { data: allContacts = [], isLoading: loadingContacts } = useQuery<any[]>({
    queryKey: ["/api/contacts/all"],
  });
  const { data: profile, isLoading: loadingProfile } = useQuery<any>({
    queryKey: ["/api/outreach-profile"],
  });

  const isLoading = loadingSub || loadingContacts;

  // ── Pipeline counts ──────────────────────────────────────────────
  const pipeline = useMemo(() => {
    const found = allContacts.length;
    const drafted = allContacts.filter((c) => c.generatedEmailMessage).length;
    const sent = allContacts.filter((c) => SENT_STATUSES.has(c.contactStatus)).length;
    const awaiting = allContacts.filter((c) => AWAITING_STATUSES.has(c.contactStatus)).length;
    const replied = allContacts.filter((c) => c.contactStatus === "replied").length;
    const interviews = allContacts.filter((c) => c.contactStatus === "interview_scheduled").length;
    return { found, drafted, sent, awaiting, replied, interviews };
  }, [allContacts]);

  // ── Quick stats ──────────────────────────────────────────────────
  const quickStats = useMemo(() => {
    const contactsThisWeek = allContacts.filter(
      (c) => c.createdAt && isWithinDays(c.createdAt, 7)
    ).length;
    const emailsDrafted = allContacts.filter((c) => c.generatedEmailMessage).length;
    const activeJobs = submissions.filter((s: any) => !s.isArchived).length;
    const profileStrength = profile?.profileCompleteness ?? 0;
    return { contactsThisWeek, emailsDrafted, activeJobs, profileStrength };
  }, [allContacts, submissions, profile]);

  // ── Action cards (conditional, prioritized) ──────────────────────
  const actionCards = useMemo(() => {
    const cards: Array<{
      id: string;
      icon: typeof Users;
      title: string;
      description: string;
      cta: string;
      onClick: () => void;
      accentColor: string;
      stat?: string;
    }> = [];

    // 1. Follow-up nudge
    const staleAwaiting = allContacts.filter(
      (c) =>
        AWAITING_STATUSES.has(c.contactStatus) &&
        c.createdAt &&
        olderThanDays(c.createdAt, 3)
    );
    if (staleAwaiting.length > 0) {
      cards.push({
        id: "follow-up",
        icon: Clock,
        title: "Follow up on outreach",
        description: `${staleAwaiting.length} contact${staleAwaiting.length > 1 ? "s" : ""} waiting 3+ days. Follow-ups boost reply rates by 22-49%.`,
        cta: "View contacts",
        onClick: () => onNavigate("contacts"),
        accentColor: "#D97706",
        stat: `${staleAwaiting.length}`,
      });
    }

    // 2. Unsent drafts
    const unsentDrafts = allContacts.filter(
      (c) => c.generatedEmailMessage && c.contactStatus === "not_contacted"
    );
    if (unsentDrafts.length > 0) {
      cards.push({
        id: "unsent",
        icon: Send,
        title: "Send your drafted messages",
        description: `${unsentDrafts.length} message${unsentDrafts.length > 1 ? "s" : ""} ready to go. Send these to start conversations.`,
        cta: "View drafts",
        onClick: () => onNavigate("contacts"),
        accentColor: "#6B46C1",
        stat: `${unsentDrafts.length}`,
      });
    }

    // 3. Profile incomplete
    const completeness = profile?.profileCompleteness ?? 0;
    if (completeness < 80) {
      cards.push({
        id: "profile",
        icon: UserCheck,
        title: "Complete your outreach profile",
        description: `Your profile is ${completeness}% complete. A stronger profile generates better AI messages.`,
        cta: "Edit profile",
        onClick: () => onNavigate("outreach-profile"),
        accentColor: "#8B5CF6",
        stat: `${completeness}%`,
      });
    }

    // 4. Start new search (no submissions or all archived)
    const activeSubmissions = submissions.filter((s: any) => !s.isArchived);
    if (activeSubmissions.length === 0) {
      cards.push({
        id: "new-search",
        icon: Search,
        title: "Start your first search",
        description: "Paste a job posting to find hiring managers and recruiters to contact directly.",
        cta: "New search",
        onClick: () => onNavigate("search"),
        accentColor: "#6B46C1",
      });
    }

    // 5. No contacts yet (have submissions but no contacts)
    if (submissions.length > 0 && allContacts.length === 0) {
      cards.push({
        id: "no-contacts",
        icon: Users,
        title: "Discover contacts",
        description: "You have saved jobs but haven't found contacts yet. Run contact discovery to get started.",
        cta: "View jobs",
        onClick: () => onNavigate("job-history"),
        accentColor: "#3B82F6",
      });
    }

    return cards.slice(0, 3);
  }, [allContacts, submissions, profile, onNavigate]);

  // ── Activity timeline ────────────────────────────────────────────
  const timeline = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      text: string;
      type: "submission" | "contact" | "draft";
    }> = [];

    // Job submissions
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

    // Contacts found
    for (const c of allContacts) {
      if (c.createdAt) {
        items.push({
          id: `contact-${c.id}`,
          date: c.createdAt,
          text: `Found ${c.name || "a contact"}${c.title ? ` (${c.title})` : ""}${c.companyName ? ` at ${c.companyName}` : ""}`,
          type: "contact",
        });
      }
      // Drafted messages (use same createdAt as proxy)
      if (c.generatedEmailMessage && c.createdAt) {
        items.push({
          id: `draft-${c.id}`,
          date: c.createdAt,
          text: `Drafted message for ${c.name || "a contact"}`,
          type: "draft",
        });
      }
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items.slice(0, 15);
  }, [submissions, allContacts]);

  // Group timeline by day
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

  // ── Loading state ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#6B46C1] animate-spin mx-auto mb-4" />
          <p className="text-[#64748B]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  const pipelineValues = pipeline as Record<string, number>;

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-[1400px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#0F172A] mb-1.5">Your Outreach Pipeline</h1>
        <p className="text-[#64748B] text-[15px]">
          Track your progress from contact discovery to interview
        </p>
      </div>

      {/* ── 1. Pipeline Funnel ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 mb-6">
        {/* Desktop: horizontal */}
        <div className="hidden md:flex items-center gap-0">
          {PIPELINE_STAGES.map((stage, i) => {
            const count = pipelineValues[stage.key] ?? 0;
            const Icon = stage.icon;
            const isLast = i === PIPELINE_STAGES.length - 1;
            return (
              <div key={stage.key} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => onNavigate("contacts")}
                  className="flex flex-col items-center gap-2 flex-1 group cursor-pointer"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${stage.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: stage.color }} />
                  </div>
                  <span className="text-2xl font-bold text-[#0F172A]">{count}</span>
                  <span className="text-xs text-[#64748B] font-medium">{stage.label}</span>
                </button>
                {!isLast && (
                  <div className="flex-shrink-0 mx-1">
                    <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: 3x2 grid */}
        <div className="md:hidden grid grid-cols-3 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const count = pipelineValues[stage.key] ?? 0;
            const Icon = stage.icon;
            return (
              <button
                key={stage.key}
                onClick={() => onNavigate("contacts")}
                className="flex flex-col items-center gap-1.5 py-3"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${stage.color}15` }}
                >
                  <Icon className="w-4 h-4" style={{ color: stage.color }} />
                </div>
                <span className="text-xl font-bold text-[#0F172A]">{count}</span>
                <span className="text-[11px] text-[#64748B] font-medium">{stage.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Quick Stats Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Contacts this week",
            value: quickStats.contactsThisWeek,
            icon: Zap,
            color: "#6B46C1",
          },
          {
            label: "Emails drafted",
            value: quickStats.emailsDrafted,
            icon: FileText,
            color: "#7C3AED",
          },
          {
            label: "Active jobs",
            value: quickStats.activeJobs,
            icon: Briefcase,
            color: "#3B82F6",
          },
          {
            label: "Profile strength",
            value: `${quickStats.profileStrength}%`,
            icon: Target,
            color: "#059669",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm px-4 py-3 flex items-center gap-3"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${stat.color}12` }}
              >
                <Icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold text-[#0F172A] leading-tight">{stat.value}</div>
                <div className="text-[11px] text-[#94A3B8] leading-tight truncate">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 3. Action Cards ────────────────────────────────────────── */}
      {actionCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {actionCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow p-5 relative overflow-hidden"
              >
                {/* Accent left border */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  style={{ backgroundColor: card.accentColor }}
                />
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${card.accentColor}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: card.accentColor }} />
                  </div>
                  {card.stat && (
                    <span
                      className="ml-auto text-sm font-bold px-2 py-0.5 rounded-md"
                      style={{
                        color: card.accentColor,
                        backgroundColor: `${card.accentColor}12`,
                      }}
                    >
                      {card.stat}
                    </span>
                  )}
                </div>
                <h3 className="text-[#0F172A] font-semibold text-sm mb-1">{card.title}</h3>
                <p className="text-[#64748B] text-xs leading-relaxed mb-4">{card.description}</p>
                <button
                  onClick={card.onClick}
                  className="text-xs font-medium flex items-center gap-1 transition-colors hover:gap-2"
                  style={{ color: card.accentColor }}
                >
                  {card.cta}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. Activity Timeline ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E2E8F0]">
          <h2 className="text-[#0F172A] text-base font-semibold">Recent Activity</h2>
        </div>

        {groupedTimeline.length === 0 ? (
          <div className="p-10 text-center">
            <Search className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
            <h3 className="text-[#0F172A] font-medium mb-1">No activity yet</h3>
            <p className="text-[#64748B] text-sm mb-5">
              Paste a job posting to start finding contacts
            </p>
            <button
              onClick={() => onNavigate("search")}
              className="px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors inline-flex items-center gap-2 text-sm"
            >
              <Search className="w-4 h-4" />
              Start New Search
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-5">
            {groupedTimeline.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">
                  {group.label}
                </div>
                <div className="space-y-0">
                  {group.items.map((item) => {
                    const dotColor =
                      item.type === "submission"
                        ? "#3B82F6"
                        : item.type === "contact"
                        ? "#6B46C1"
                        : "#8B5CF6";
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 py-2 group"
                      >
                        <div className="flex-shrink-0 mt-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#1A202C] leading-snug truncate">
                            {item.text}
                          </p>
                        </div>
                        <span className="text-[11px] text-[#94A3B8] flex-shrink-0">
                          {formatTime(item.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
