import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { FeatureLockBadge, FeatureLockOverlay } from "./FeatureLock";
import { usePlanAccess } from "../hooks/usePlanAccess";
import {
  FileText, Send, Eye, MessageSquare, TrendingUp, TrendingDown,
  Search, Filter, Calendar, Tag, ChevronDown, X, Check,
  Clock, AlertCircle, ArrowRight, Mail, Loader2, Plus,
} from "lucide-react";

interface OutreachHubProps {
  onNavigate: (page: string, data?: any) => void;
}

// ── Predefined tags ──────────────────────────────────────────────────
const PREDEFINED_TAGS = [
  "Hot Lead",
  "High Priority",
  "Call Scheduled",
  "Needs Revision",
  "Referral",
  "Cold Outreach",
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "Hot Lead": { bg: "#fef2f2", text: "#dc2626" },
  "High Priority": { bg: "#fff7ed", text: "#ea580c" },
  "Call Scheduled": { bg: "#eff6ff", text: "#2563eb" },
  "Needs Revision": { bg: "#fefce8", text: "#ca8a04" },
  "Referral": { bg: "#f0fdf4", text: "#16a34a" },
  "Cold Outreach": { bg: "#f8fafc", text: "#64748b" },
};

// ── Helpers ──────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function isWithinDays(dateStr: string, days: number): boolean {
  return Date.now() - new Date(dateStr).getTime() <= days * 86_400_000;
}

function isWithinMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

// ── StatusBadge ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    email_sent: { bg: "#eff6ff", text: "#2563eb", icon: Send, label: "Sent" },
    linkedin_sent: { bg: "#eff6ff", text: "#2563eb", icon: Send, label: "LinkedIn Sent" },
    awaiting_reply: { bg: "#fffbeb", text: "#d97706", icon: Clock, label: "Awaiting Reply" },
    follow_up_needed: { bg: "#fff7ed", text: "#ea580c", icon: AlertCircle, label: "Follow-up" },
    replied: { bg: "#f0fdf4", text: "#16a34a", icon: MessageSquare, label: "Replied" },
    interview_scheduled: { bg: "#f0fdf4", text: "#059669", icon: Check, label: "Interview" },
    not_contacted: { bg: "#f3f4f6", text: "#6b7280", icon: Mail, label: "Not Contacted" },
  };
  const c = config[status] || config.not_contacted;
  const Icon = c.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 500,
        padding: "3px 10px",
        borderRadius: 20,
        background: c.bg,
        color: c.text,
      }}
    >
      <Icon style={{ width: 12, height: 12 }} />
      {c.label}
    </span>
  );
}

// ── DeltaBadge ───────────────────────────────────────────────────────
function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const positive = value > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: 11,
        fontWeight: 600,
        color: positive ? "#16a34a" : "#dc2626",
        background: positive ? "#f0fdf4" : "#fef2f2",
        padding: "2px 6px",
        borderRadius: 8,
      }}
    >
      <Icon style={{ width: 10, height: 10 }} />
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

// ── TagPill ──────────────────────────────────────────────────────────
function TagPill({ tag }: { tag: string }) {
  const colors = TAG_COLORS[tag] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 10,
        background: colors.bg,
        color: colors.text,
        whiteSpace: "nowrap",
      }}
    >
      {tag}
    </span>
  );
}

// ── Custom dropdown hook (close on outside click) ────────────────────
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return { open, setOpen, ref };
}

// ── useContainerWidth (ResizeObserver) ───────────────────────────────
function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

// ── Tab button style helper ──────────────────────────────────────────
function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? "#6B46C1" : "#6b7280",
    background: active ? "#f5f3ff" : "transparent",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.15s",
  };
}

// ── Pill button style helper ─────────────────────────────────────────
function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 500,
    color: active ? "#6B46C1" : "#6b7280",
    background: active ? "#f5f3ff" : "#ffffff",
    border: `1px solid ${active ? "#6B46C1" : "#e5e7eb"}`,
    borderRadius: 20,
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap" as const,
  };
}

// =====================================================================
// OverviewTab
// =====================================================================
function OverviewTab({ onNavigate }: { onNavigate: OutreachHubProps["onNavigate"] }) {
  const [period, setPeriod] = useState("7d");
  const [emailFilter, setEmailFilter] = useState("");
  const [emailCategory, setEmailCategory] = useState<"all" | "draft" | "sent" | "replied" | "follow_up">("all");
  const { ref: containerRef, width } = useContainerWidth();
  const narrow = width < 700;

  const { data: metrics, isLoading } = useQuery<any>({
    queryKey: ["/api/outreach/metrics", period],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/outreach/metrics?period=${period}`);
      return res.json();
    },
  });

  // Fetch ALL contacts for the recent emails table
  const { data: allContacts = [] } = useQuery<any[]>({
    queryKey: ["/api/outreach/contacts", "overview-all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/outreach/contacts?limit=100");
      return res.json();
    },
  });

  // Also fetch drafts (contacts with generated messages but not contacted)
  const { data: draftContacts = [] } = useQuery<any[]>({
    queryKey: ["/api/contacts/all", "overview-drafts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/contacts/all");
      return res.json();
    },
  });

  const periodOptions = [
    { key: "today", label: "Today" },
    { key: "7d", label: "Last 7 days" },
    { key: "month", label: "This month" },
    { key: "all", label: "All Time" },
  ];

  const categoryOptions = [
    { key: "all" as const, label: "All" },
    { key: "draft" as const, label: "Drafts" },
    { key: "sent" as const, label: "Sent" },
    { key: "replied" as const, label: "Replies" },
    { key: "follow_up" as const, label: "Follow-ups" },
  ];

  // Classify contacts into categories and merge
  const recentEmails = useMemo(() => {
    const sentStatuses = new Set(["email_sent", "linkedin_sent", "awaiting_reply"]);
    const followUpStatuses = new Set(["follow_up_needed"]);
    const repliedStatuses = new Set(["replied", "interview_scheduled"]);

    // From outreach contacts (already contacted)
    const contacted = allContacts.map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      subject: c.emailSubject || "—",
      company: c.companyName,
      date: c.lastContactedAt || c.createdAt,
      category: repliedStatuses.has(c.contactStatus)
        ? "replied"
        : followUpStatuses.has(c.contactStatus)
          ? "follow_up"
          : sentStatuses.has(c.contactStatus)
            ? "sent"
            : "sent",
      status: c.contactStatus,
    }));

    // From all contacts — just drafts (have generated message, not contacted/sent)
    const sentSet = new Set(["email_sent", "linkedin_sent", "awaiting_reply", "follow_up_needed", "replied", "interview_scheduled"]);
    const drafts = draftContacts
      .filter((c: any) => c.generatedEmailMessage && !sentSet.has(c.contactStatus))
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        subject: c.emailSubject || "Draft",
        company: c.companyName,
        date: c.createdAt,
        category: "draft" as const,
        status: "draft",
      }));

    let combined = [...contacted, ...drafts];

    // Sort by date descending
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filter by category
    if (emailCategory !== "all") {
      combined = combined.filter((c) => c.category === emailCategory);
    }

    // Search filter
    if (emailFilter.trim()) {
      const q = emailFilter.toLowerCase();
      combined = combined.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.subject || "").toLowerCase().includes(q) ||
          (c.company || "").toLowerCase().includes(q)
      );
    }

    return combined.slice(0, 25);
  }, [allContacts, draftContacts, emailFilter, emailCategory]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader2 style={{ width: 28, height: 28, color: "#6B46C1", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const drafted = metrics?.drafted ?? 0;
  const draftedDelta = metrics?.draftedDelta ?? 0;
  const sent = metrics?.sent ?? 0;
  const sentDelta = metrics?.sentDelta ?? 0;
  const opened = metrics?.opened ?? 0;
  const openedDelta = metrics?.openedDelta ?? 0;
  const replied = metrics?.replied ?? 0;
  const repliedDelta = metrics?.repliedDelta ?? 0;

  return (
    <div ref={containerRef}>
      {/* Time filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {periodOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
            style={pillStyle(period === opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Metric card groups */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: narrow ? "1fr" : "1fr 1fr",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {/* Initiation card */}
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
              padding: "10px 16px",
              borderBottom: "1px solid #f3f4f6",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "#9ca3af",
            }}
          >
            Initiation
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {/* Drafted */}
            <div
              style={{
                padding: "20px 16px",
                borderRight: "1px solid #f3f4f6",
                position: "relative",
              }}
            >
              <FileText style={{ width: 16, height: 16, color: "#9ca3af", marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>
                {drafted}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Drafted</div>
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <DeltaBadge value={draftedDelta} />
              </div>
            </div>
            {/* Sent */}
            <div style={{ padding: "20px 16px", position: "relative" }}>
              <Send style={{ width: 16, height: 16, color: "#9ca3af", marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>
                {sent}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Sent</div>
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <DeltaBadge value={sentDelta} />
              </div>
            </div>
          </div>
        </div>

        {/* Engagement card */}
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
              padding: "10px 16px",
              borderBottom: "1px solid #f3f4f6",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "#9ca3af",
            }}
          >
            Engagement
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {/* Opened */}
            <div
              style={{
                padding: "20px 16px",
                borderRight: "1px solid #f3f4f6",
                position: "relative",
              }}
            >
              <Eye style={{ width: 16, height: 16, color: "#9ca3af", marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>
                {opened}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Opened</div>
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <DeltaBadge value={openedDelta} />
              </div>
            </div>
            {/* Replied */}
            <div style={{ padding: "20px 16px", position: "relative" }}>
              <MessageSquare style={{ width: 16, height: 16, color: "#9ca3af", marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>
                {replied}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Replied</div>
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <DeltaBadge value={repliedDelta} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Emails section */}
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
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: 0 }}>
            Recent emails
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Search input */}
            <div style={{ position: "relative" }}>
              <Search
                style={{
                  width: 14,
                  height: 14,
                  color: "#9ca3af",
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                type="text"
                placeholder="Search emails..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                style={{
                  padding: "6px 10px 6px 30px",
                  fontSize: 13,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  outline: "none",
                  width: 180,
                  background: "#f9fafb",
                }}
              />
            </div>
            {/* Category pills */}
            {categoryOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setEmailCategory(opt.key)}
                style={pillStyle(emailCategory === opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {recentEmails.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Mail style={{ width: 24, height: 24, color: "#d1d5db", margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No emails yet</p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 1fr 90px 120px 100px",
                padding: "8px 20px",
                borderBottom: "1px solid #f3f4f6",
                fontSize: 11,
                fontWeight: 600,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              <span />
              <span>Contact</span>
              <span>Subject</span>
              <span>Category</span>
              <span>Company</span>
              <span>Date</span>
            </div>
            {/* Table rows */}
            {recentEmails.map((item: any, i: number) => {
              const initial = (item.name || "?")[0].toUpperCase();
              const catConfig: Record<string, { bg: string; text: string; label: string }> = {
                draft: { bg: "#f3f4f6", text: "#6b7280", label: "Draft" },
                sent: { bg: "#eff6ff", text: "#2563eb", label: "Sent" },
                replied: { bg: "#f0fdf4", text: "#16a34a", label: "Replied" },
                follow_up: { bg: "#fff7ed", text: "#ea580c", label: "Follow-up" },
              };
              const cat = catConfig[item.category] || catConfig.draft;

              return (
                <div
                  key={`${item.id}-${item.category}-${i}`}
                  onClick={() => onNavigate("contact-detail", { contactId: item.id })}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px 1fr 1fr 90px 120px 100px",
                    padding: "10px 20px",
                    borderBottom: "1px solid #f9fafb",
                    alignItems: "center",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#fafbfc"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "#ede9fe",
                      color: "#7c3aed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {initial}
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.email || "—"}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.subject || "—"}
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 12,
                      background: cat.bg,
                      color: cat.text,
                      textAlign: "center",
                      width: "fit-content",
                    }}
                  >
                    {cat.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.company || "—"}
                  </span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    {item.date ? formatDate(item.date) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// TagEditorPopover
// =====================================================================
function TagEditorPopover({
  contactId,
  currentTags,
  anchorRect,
  onClose,
}: {
  contactId: number;
  currentTags: string[];
  anchorRect: { top: number; left: number };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>(currentTags);
  const [customTag, setCustomTag] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: async (newTags: string[]) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contactId}`, { tags: newTags });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/contacts"] });
      onClose();
    },
  });

  function toggleTag(tag: string) {
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    setTags(next);
    mutation.mutate(next);
  }

  function addCustom() {
    const trimmed = customTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    const next = [...tags, trimmed];
    setTags(next);
    setCustomTag("");
    mutation.mutate(next);
  }

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: anchorRect.top,
        left: anchorRect.left,
        zIndex: 9999,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        padding: 12,
        width: 220,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
        Tags
      </div>
      {PREDEFINED_TAGS.map((tag) => {
        const checked = tags.includes(tag);
        return (
          <label
            key={tag}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
              cursor: "pointer",
              fontSize: 13,
              color: "#374151",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: `1px solid ${checked ? "#6B46C1" : "#d1d5db"}`,
                background: checked ? "#6B46C1" : "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              onClick={(e) => { e.preventDefault(); toggleTag(tag); }}
            >
              {checked && <Check style={{ width: 10, height: 10, color: "#ffffff" }} />}
            </div>
            <span onClick={(e) => { e.preventDefault(); toggleTag(tag); }}>{tag}</span>
          </label>
        );
      })}
      <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 8, paddingTop: 8, display: "flex", gap: 4 }}>
        <input
          type="text"
          placeholder="Custom tag..."
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
          style={{
            flex: 1,
            fontSize: 12,
            padding: "5px 8px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            outline: "none",
          }}
        />
        <button
          onClick={addCustom}
          style={{
            padding: "5px 8px",
            fontSize: 12,
            fontWeight: 500,
            color: "#ffffff",
            background: "#6B46C1",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Plus style={{ width: 12, height: 12 }} />
          Add
        </button>
      </div>
      {mutation.isPending && (
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <Loader2 style={{ width: 14, height: 14, color: "#6B46C1", animation: "spin 1s linear infinite" }} />
        </div>
      )}
    </div>
  );
}

// =====================================================================
// MultiCheckboxDropdown
// =====================================================================
function MultiCheckboxDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const { open, setOpen, ref } = useDropdown();

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          fontSize: 13,
          color: selected.length > 0 ? "#111827" : "#6b7280",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {selected.length > 0 && (
          <span
            style={{
              background: "#6B46C1",
              color: "#ffffff",
              fontSize: 10,
              fontWeight: 600,
              padding: "1px 5px",
              borderRadius: 8,
              minWidth: 16,
              textAlign: "center",
            }}
          >
            {selected.length}
          </span>
        )}
        <ChevronDown style={{ width: 14, height: 14, color: "#9ca3af" }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            padding: 8,
            minWidth: 180,
          }}
        >
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 6px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#374151",
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1px solid ${checked ? "#6B46C1" : "#d1d5db"}`,
                    background: checked ? "#6B46C1" : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  onClick={(e) => { e.preventDefault(); toggle(opt.value); }}
                >
                  {checked && <Check style={{ width: 10, height: 10, color: "#ffffff" }} />}
                </div>
                <span onClick={(e) => { e.preventDefault(); toggle(opt.value); }}>{opt.label}</span>
              </label>
            );
          })}
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              style={{
                display: "block",
                width: "100%",
                padding: "5px 6px",
                marginTop: 4,
                fontSize: 12,
                color: "#6B46C1",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// SentMessagesTab
// =====================================================================
function SentMessagesTab({ onNavigate }: { onNavigate: OutreachHubProps["onNavigate"] }) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const companyDropdown = useDropdown();
  const { ref: containerRef, width } = useContainerWidth();
  const narrow = width < 700;

  // Tag editor state
  const [tagEditor, setTagEditor] = useState<{
    contactId: number;
    tags: string[];
    rect: { top: number; left: number };
  } | null>(null);

  const { data: contacts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/outreach/contacts"],
  });

  const { data: companies = [] } = useQuery<string[]>({
    queryKey: ["/api/outreach/companies"],
  });

  const statusOptions = [
    { value: "email_sent", label: "Email Sent" },
    { value: "linkedin_sent", label: "LinkedIn Sent" },
    { value: "awaiting_reply", label: "Awaiting Reply" },
    { value: "follow_up_needed", label: "Follow-up Needed" },
    { value: "replied", label: "Replied" },
    { value: "interview_scheduled", label: "Interview Scheduled" },
    { value: "not_contacted", label: "Not Contacted" },
  ];

  const tagOptions = PREDEFINED_TAGS.map((t) => ({ value: t, label: t }));

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = contacts;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c: any) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((c: any) => c.lastContactedAt && new Date(c.lastContactedAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000;
      list = list.filter((c: any) => c.lastContactedAt && new Date(c.lastContactedAt).getTime() < to);
    }

    if (selectedCompany) {
      list = list.filter((c: any) => (c.companyName || "") === selectedCompany);
    }

    if (selectedStatuses.length > 0) {
      list = list.filter((c: any) => selectedStatuses.includes(c.contactStatus || "not_contacted"));
    }

    if (selectedTags.length > 0) {
      list = list.filter((c: any) => {
        const cTags: string[] = c.tags || [];
        return selectedTags.some((t) => cTags.includes(t));
      });
    }

    return list;
  }, [contacts, search, dateFrom, dateTo, selectedCompany, selectedStatuses, selectedTags]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader2 style={{ width: 28, height: 28, color: "#6B46C1", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: narrow ? "1 1 100%" : "0 1 auto" }}>
          <Search
            style={{
              width: 14,
              height: 14,
              color: "#9ca3af",
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "7px 10px 7px 30px",
              fontSize: 13,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              outline: "none",
              width: narrow ? "100%" : 200,
              background: "#f9fafb",
            }}
          />
        </div>

        {/* Date from */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Calendar style={{ width: 14, height: 14, color: "#9ca3af" }} />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: "6px 8px",
              fontSize: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              outline: "none",
              color: dateFrom ? "#111827" : "#9ca3af",
            }}
          />
          <span style={{ fontSize: 12, color: "#9ca3af" }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: "6px 8px",
              fontSize: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              outline: "none",
              color: dateTo ? "#111827" : "#9ca3af",
            }}
          />
        </div>

        {/* Company dropdown */}
        <div ref={companyDropdown.ref} style={{ position: "relative" }}>
          <button
            onClick={() => companyDropdown.setOpen(!companyDropdown.open)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              fontSize: 13,
              color: selectedCompany ? "#111827" : "#6b7280",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {selectedCompany || "Company"}
            <ChevronDown style={{ width: 14, height: 14, color: "#9ca3af" }} />
          </button>
          {companyDropdown.open && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                zIndex: 50,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                padding: 4,
                minWidth: 180,
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              <div
                onClick={() => { setSelectedCompany(""); companyDropdown.setOpen(false); }}
                style={{
                  padding: "6px 10px",
                  fontSize: 13,
                  color: "#6b7280",
                  cursor: "pointer",
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                All companies
              </div>
              {(companies as string[]).map((c) => (
                <div
                  key={c}
                  onClick={() => { setSelectedCompany(c); companyDropdown.setOpen(false); }}
                  style={{
                    padding: "6px 10px",
                    fontSize: 13,
                    color: "#111827",
                    cursor: "pointer",
                    borderRadius: 6,
                    fontWeight: selectedCompany === c ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status dropdown */}
        <MultiCheckboxDropdown
          label="Status"
          options={statusOptions}
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
        />

        {/* Tags dropdown */}
        <MultiCheckboxDropdown
          label="Tags"
          options={tagOptions}
          selected={selectedTags}
          onChange={setSelectedTags}
        />
      </div>

      {/* Table */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: narrow
              ? "1fr 100px"
              : "1.2fr 1.5fr 100px 120px 1fr 1fr",
            padding: "10px 20px",
            borderBottom: "1px solid #f3f4f6",
            fontSize: 11,
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          <span>Contact</span>
          {!narrow && <span>Subject</span>}
          <span>Date</span>
          {!narrow && <span>Status</span>}
          {!narrow && <span>Company</span>}
          {!narrow && <span>Tags</span>}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Send style={{ width: 24, height: 24, color: "#d1d5db", margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
              No sent messages match your filters
            </p>
          </div>
        ) : (
          filtered.map((contact: any) => {
            const contactTags: string[] = contact.tags || [];
            return (
              <div
                key={contact.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: narrow
                    ? "1fr 100px"
                    : "1.2fr 1.5fr 100px 120px 1fr 1fr",
                  padding: "12px 20px",
                  borderBottom: "1px solid #f9fafb",
                  alignItems: "center",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#fafbfc"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Contact name */}
                <span
                  onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#111827",
                    cursor: "pointer",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#6B46C1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#111827"; }}
                >
                  {contact.name || "Unknown"}
                </span>

                {/* Subject */}
                {!narrow && (
                  <span
                    style={{
                      fontSize: 13,
                      color: "#6b7280",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      paddingRight: 8,
                    }}
                  >
                    {contact.emailSubject || "—"}
                  </span>
                )}

                {/* Date */}
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {contact.lastContactedAt ? formatDate(contact.lastContactedAt) : "—"}
                </span>

                {/* Status */}
                {!narrow && (
                  <span>
                    <StatusBadge status={contact.contactStatus || "not_contacted"} />
                  </span>
                )}

                {/* Company */}
                {!narrow && (
                  <span
                    style={{
                      fontSize: 13,
                      color: "#6b7280",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {contact.companyName || "—"}
                  </span>
                )}

                {/* Tags */}
                {!narrow && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexWrap: "wrap",
                      cursor: "pointer",
                      minHeight: 24,
                    }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTagEditor({
                        contactId: contact.id,
                        tags: contactTags,
                        rect: { top: rect.bottom + 4, left: rect.left },
                      });
                    }}
                  >
                    {contactTags.length > 0 ? (
                      contactTags.map((tag) => <TagPill key={tag} tag={tag} />)
                    ) : (
                      <span style={{ fontSize: 12, color: "#d1d5db" }}>+ Add tag</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Tag editor popover */}
      {tagEditor && (
        <TagEditorPopover
          contactId={tagEditor.contactId}
          currentTags={tagEditor.tags}
          anchorRect={tagEditor.rect}
          onClose={() => setTagEditor(null)}
        />
      )}
    </div>
  );
}

// =====================================================================
// FollowUpsTab
// =====================================================================
function FollowUpsTab({ onNavigate }: { onNavigate: OutreachHubProps["onNavigate"] }) {
  const queryClient = useQueryClient();
  const { ref: containerRef, width } = useContainerWidth();
  const narrow = width < 600;

  const { data: followUpsData, isLoading } = useQuery<{ contacts: any[] }>({
    queryKey: ["/api/outreach/follow-ups"],
  });

  const followUpMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const res = await apiRequest("POST", "/api/outreach/activities", {
        contactId,
        activityType: "follow_up_sent",
        channel: "email",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/contacts"] });
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader2 style={{ width: 28, height: 28, color: "#6B46C1", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const contacts = followUpsData?.contacts ?? [];

  // Split into overdue (>7 days) and due soon (5-7 days)
  const overdue = contacts.filter((c: any) => {
    const days = c.last_contacted_at ? daysSince(c.last_contacted_at) : 0;
    return days > 7;
  });

  const dueSoon = contacts.filter((c: any) => {
    const days = c.last_contacted_at ? daysSince(c.last_contacted_at) : 0;
    return days >= 5 && days <= 7;
  });

  if (overdue.length === 0 && dueSoon.length === 0) {
    return (
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 60,
          textAlign: "center",
        }}
      >
        <Check style={{ width: 32, height: 32, color: "#16a34a", margin: "0 auto 12px" }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>
          No follow-ups due
        </h3>
        <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>
          You're all caught up!
        </p>
      </div>
    );
  }

  function renderGroup(title: string, items: any[], tint: "red" | "amber") {
    if (items.length === 0) return null;
    const headerBg = tint === "red" ? "#fef2f2" : "#fffbeb";
    const headerColor = tint === "red" ? "#dc2626" : "#d97706";
    const headerBorder = tint === "red" ? "#fecaca" : "#fde68a";

    return (
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        {/* Group header */}
        <div
          style={{
            padding: "10px 20px",
            background: headerBg,
            borderBottom: `1px solid ${headerBorder}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {tint === "red" ? (
            <AlertCircle style={{ width: 14, height: 14, color: headerColor }} />
          ) : (
            <Clock style={{ width: 14, height: 14, color: headerColor }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: headerColor }}>
            {title} ({items.length})
          </span>
        </div>

        {/* Contact cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: narrow ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 0,
          }}
        >
          {items.map((contact: any) => {
            const days = contact.last_contacted_at ? daysSince(contact.last_contacted_at) : 0;
            const initial = ((contact.full_name || contact.name || "?")[0] || "?").toUpperCase();
            const followUpCount = contact.follow_up_count ?? 0;
            const company = contact.job_submissions?.company_name || contact.companyName || "";

            return (
              <div
                key={contact.id}
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: tint === "red" ? "#fee2e2" : "#fef3c7",
                    color: tint === "red" ? "#dc2626" : "#d97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {initial}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {contact.full_name || contact.name || "Unknown"}
                    </span>
                    {followUpCount > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#6b7280",
                          background: "#f3f4f6",
                          padding: "1px 6px",
                          borderRadius: 8,
                        }}
                      >
                        {followUpCount}x
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {contact.title || ""}
                    {company ? ` at ${company}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: headerColor, fontWeight: 500, marginTop: 2 }}>
                    {days} days since last contact
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => followUpMutation.mutate(contact.id)}
                    disabled={followUpMutation.isPending}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#ffffff",
                      background: "#6B46C1",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      opacity: followUpMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    <Mail style={{ width: 12, height: 12 }} />
                    Follow Up
                  </button>
                  <button
                    onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#6B46C1",
                      background: "#f5f3ff",
                      border: "1px solid #ede9fe",
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Eye style={{ width: 12, height: 12 }} />
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      {renderGroup("Overdue", overdue, "red")}
      {renderGroup("Due Soon", dueSoon, "amber")}
    </div>
  );
}

// =====================================================================
// =====================================================================
// DraftsTab — contacts with generated messages not yet sent
// =====================================================================
function DraftsTab({ onNavigate }: { onNavigate: OutreachHubProps["onNavigate"] }) {
  const [search, setSearch] = useState("");

  const { data: allContacts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/contacts/all", "drafts-tab"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/contacts/all");
      return res.json();
    },
  });

  const drafts = useMemo(() => {
    const sentStatuses = new Set(["email_sent", "linkedin_sent", "awaiting_reply", "follow_up_needed", "replied", "interview_scheduled"]);
    let filtered = allContacts.filter(
      (c: any) => c.generatedEmailMessage && !sentStatuses.has(c.contactStatus)
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (c: any) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.companyName || "").toLowerCase().includes(q)
      );
    }
    return filtered.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [allContacts, search]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader2 style={{ width: 28, height: 28, color: "#6B46C1", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 16, position: "relative", maxWidth: 320 }}>
        <Search style={{ width: 14, height: 14, color: "#9ca3af", position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input
          type="text"
          placeholder="Search drafts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px 8px 34px", fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 8, outline: "none", width: "100%", background: "#fff" }}
        />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        {drafts.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <FileText style={{ width: 24, height: 24, color: "#d1d5db", margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No drafts yet. Generate a message from a contact to see it here.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 100px", padding: "8px 20px", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.3 }}>
              <span>Contact</span>
              <span>Company</span>
              <span>Job</span>
              <span>Created</span>
            </div>
            {drafts.map((c: any) => (
              <div
                key={c.id}
                onClick={() => onNavigate("contact-detail", { contactId: c.id })}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 100px", padding: "12px 20px", borderBottom: "1px solid #f9fafb", alignItems: "center", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#fafbfc"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.title || "—"}</div>
                </div>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{c.companyName || "—"}</span>
                <span style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.jobTitle || "—"}</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{formatDate(c.createdAt)}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
        {drafts.length} draft{drafts.length !== 1 ? "s" : ""} ready to send
      </p>
    </div>
  );
}

// =====================================================================
// RepliesTab — contacts that have replied
// =====================================================================
function RepliesTab({ onNavigate }: { onNavigate: OutreachHubProps["onNavigate"] }) {
  const [search, setSearch] = useState("");

  const { data: contacts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/outreach/contacts", "replies-tab"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/outreach/contacts?status=replied,interview_scheduled&limit=100");
      return res.json();
    },
  });

  const replies = useMemo(() => {
    let filtered = contacts;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (c: any) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.companyName || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [contacts, search]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader2 style={{ width: 28, height: 28, color: "#6B46C1", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, position: "relative", maxWidth: 320 }}>
        <Search style={{ width: 14, height: 14, color: "#9ca3af", position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input
          type="text"
          placeholder="Search replies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px 8px 34px", fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 8, outline: "none", width: "100%", background: "#fff" }}
        />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        {replies.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <MessageSquare style={{ width: 24, height: 24, color: "#d1d5db", margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No replies yet. Keep sending — they'll come!</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 120px 100px", padding: "8px 20px", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.3 }}>
              <span>Contact</span>
              <span>Company</span>
              <span>Status</span>
              <span>Tags</span>
              <span>Date</span>
            </div>
            {replies.map((c: any) => (
              <div
                key={c.id}
                onClick={() => onNavigate("contact-detail", { contactId: c.id })}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 120px 100px", padding: "12px 20px", borderBottom: "1px solid #f9fafb", alignItems: "center", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#fafbfc"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.email || "—"}</div>
                </div>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{c.companyName || "—"}</span>
                <StatusBadge status={c.contactStatus} />
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(c.tags || []).slice(0, 2).map((tag: string) => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{c.lastContactedAt ? formatDate(c.lastContactedAt) : "—"}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
        {replies.length} repl{replies.length !== 1 ? "ies" : "y"}
      </p>
    </div>
  );
}

// OutreachHub (main export)
// =====================================================================
export function OutreachHub({ onNavigate }: OutreachHubProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "drafts" | "sent" | "replies" | "followups">("overview");
  const { canAccessOutreachHub } = usePlanAccess();

  const lockedTabs = new Set(["sent", "replies", "followups"]);

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "drafts" as const, label: "Drafts" },
    { key: "sent" as const, label: "Sent Messages" },
    { key: "replies" as const, label: "Replies" },
    { key: "followups" as const, label: "Follow-ups" },
  ];

  return (
    <div style={{ padding: 24, minHeight: "100%", background: "#f9fafb" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
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
            Outreach Hub
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#6b7280",
              margin: "4px 0 0",
            }}
          >
            Track your outreach pipeline, sent messages, and follow-ups.
          </p>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 24,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 4,
            width: "fit-content",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{ ...tabStyle(activeTab === tab.key), display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              {tab.label}
              {lockedTabs.has(tab.key) && (
                <FeatureLockBadge feature="outreachHub" requiredPlan="pro" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && <OverviewTab onNavigate={onNavigate} />}
        {activeTab === "drafts" && <DraftsTab onNavigate={onNavigate} />}
        {activeTab === "sent" && (
          !canAccessOutreachHub ? (
            <FeatureLockOverlay feature="outreachHub" requiredPlan="pro" onUpgrade={() => onNavigate("billing")}>
              <SentMessagesTab onNavigate={onNavigate} />
            </FeatureLockOverlay>
          ) : (
            <SentMessagesTab onNavigate={onNavigate} />
          )
        )}
        {activeTab === "replies" && (
          !canAccessOutreachHub ? (
            <FeatureLockOverlay feature="outreachHub" requiredPlan="pro" onUpgrade={() => onNavigate("billing")}>
              <RepliesTab onNavigate={onNavigate} />
            </FeatureLockOverlay>
          ) : (
            <RepliesTab onNavigate={onNavigate} />
          )
        )}
        {activeTab === "followups" && (
          !canAccessOutreachHub ? (
            <FeatureLockOverlay feature="outreachHub" requiredPlan="pro" onUpgrade={() => onNavigate("billing")}>
              <FollowUpsTab onNavigate={onNavigate} />
            </FeatureLockOverlay>
          ) : (
            <FollowUpsTab onNavigate={onNavigate} />
          )
        )}
      </div>

      {/* Spin keyframes (for Loader2 animation) */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
