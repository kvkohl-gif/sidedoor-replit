import {
  ArrowLeft,
  MapPin,
  ChevronDown,
  ChevronRight,
  Mail,
  Linkedin,
  Copy,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Plus,
  ExternalLink,
  X,
  Sparkles,
  Eye,
  Loader2,
  Building2,
  Briefcase,
  Calendar,
  FileText,
  Save,
  Users,
  Check,
  Clock,
  Shield,
  TrendingUp,
  Star,
  UserCheck,
  Tag,
  MoreHorizontal,
  Send,
  Globe,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";

interface Recruiter {
  id: number;
  name: string | null;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  verificationStatus: string;
  emailDraft: string | null;
  linkedinMessage: string | null;
  outreachBucket: string;
  contactStatus: string | null;
  lastContactedAt: string | null;
  department: string | null;
  seniority: string | null;
  confidenceScore?: number | null;
  recruiterConfidence?: string | null;
}

interface JobSubmissionWithRecruiters {
  id: number;
  jobTitle: string | null;
  companyName: string | null;
  companyDomain: string | null;
  jobInput: string;
  openaiResponseRaw: string | null;
  status: string;
  notes: string | null;
  submittedAt: string | null;
  recruiters: Recruiter[];
}

interface ParsedJobData {
  location: string | null;
  summary: string | null;
  reportsTo: string | null;
  department: string | null;
  jobDescription: string | null;
  responsibilities: string[];
  requirements: string[];
  companyDescription: string | null;
  salary: string | null;
}

interface JobDetailsProps {
  submissionId?: number;
  onNavigate: (page: string, params?: Record<string, any>) => void;
}

function parseOpenAIData(raw: string | null): ParsedJobData {
  const defaults: ParsedJobData = {
    location: null, summary: null, reportsTo: null, department: null,
    jobDescription: null, responsibilities: [], requirements: [],
    companyDescription: null, salary: null,
  };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    const basic = parsed.basic_extraction || parsed;
    const enhanced = parsed.enhanced_data || {};
    return {
      location: enhanced.location || basic.location || null,
      summary: basic.summary || null,
      reportsTo: enhanced.reports_to || null,
      department: enhanced.likely_departments?.[0] || null,
      jobDescription: enhanced.job_description || null,
      responsibilities: enhanced.key_responsibilities || [],
      requirements: enhanced.requirements || [],
      companyDescription: null,
      salary: null,
    };
  } catch { return defaults; }
}

function extractCompanyDescription(jobInput: string, companyName: string | null): string | null {
  if (!jobInput || !companyName) return null;
  const markers = [
    `about ${companyName}`, "about the company", "about us",
    "company overview", "who we are", `what is ${companyName}`,
  ];
  const lower = jobInput.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      const section = jobInput.slice(idx);
      const endMarkers = ["\n\n\n", "responsibilities", "requirements", "qualifications", "what you'll do", "what we're looking for", "the role"];
      let end = section.length;
      for (const em of endMarkers) {
        const emIdx = section.toLowerCase().indexOf(em, marker.length + 20);
        if (emIdx !== -1 && emIdx < end) end = emIdx;
      }
      const text = section.slice(0, end).trim();
      if (text.length > 40) return text;
    }
  }
  return null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "Unknown"; }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(dateStr);
  } catch { return ""; }
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatSeniority(s: string | null): string | null {
  if (!s) return null;
  const map: Record<string, string> = {
    c_suite: "C-Suite", vp: "VP", director: "Director", head: "Head",
    lead: "Lead", senior: "Senior", manager: "Manager", entry: "Entry",
  };
  return map[s.toLowerCase()] || s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

/** Get match quality based on bucket + seniority */
function getMatchInfo(contact: Recruiter): { label: string; color: string; dotColor: string } {
  if (contact.outreachBucket === "department_lead") {
    if (contact.seniority && /director|vp|head|c_suite|chief/i.test(contact.seniority)) {
      return { label: "Top Match", color: "#059669", dotColor: "#10b981" };
    }
    return { label: "Strong", color: "#0891b2", dotColor: "#22d3ee" };
  }
  if (contact.seniority && /senior|lead|head/i.test(contact.seniority)) {
    return { label: "Strong", color: "#7c3aed", dotColor: "#a78bfa" };
  }
  return { label: "Match", color: "#6b7280", dotColor: "#9ca3af" };
}

export function JobDetails({ submissionId, onNavigate }: JobDetailsProps) {
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showFullJD, setShowFullJD] = useState(false);
  const [showCompanyDesc, setShowCompanyDesc] = useState(false);
  const [showResponsibilities, setShowResponsibilities] = useState(true);
  const [notesValue, setNotesValue] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logSelectedContact, setLogSelectedContact] = useState<number | null>(null);
  const [generatingMessageFor, setGeneratingMessageFor] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedContact, setExpandedContact] = useState<number | null>(null);

  const { data: submission, isLoading, error } = useQuery<JobSubmissionWithRecruiters>({
    queryKey: ["/api/submissions", submissionId],
    enabled: !!submissionId,
  });

  useEffect(() => {
    if (submission) {
      setNotesValue(submission.notes || "");
      setNotesDirty(false);
    }
  }, [submission]);

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!submissionId) return;
      await apiRequest("PATCH", `/api/submissions/${submissionId}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] });
    },
  });

  const notesMutation = useMutation({
    mutationFn: async (notes: string) => {
      if (!submissionId) return;
      await apiRequest("PATCH", `/api/submissions/${submissionId}`, { notes });
    },
    onSuccess: () => {
      setNotesDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] });
    },
  });

  const logOutreachMutation = useMutation({
    mutationFn: async (contactId: number) => {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, {
        contactStatus: "email_sent",
        lastContactedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] });
      setLogModalOpen(false);
      setLogSelectedContact(null);
    },
  });

  const generateMessageMutation = useMutation({
    mutationFn: async (contactId: number) => {
      setGeneratingMessageFor(contactId);
      await apiRequest("POST", `/api/contacts/${contactId}/generate-message`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] });
      setGeneratingMessageFor(null);
    },
    onError: () => {
      setGeneratingMessageFor(null);
    },
  });

  const emailStatusConfig: Record<string, { icon: typeof CheckCircle; text: string; color: string; bg: string }> = {
    valid: { icon: CheckCircle, text: "Verified", color: "#059669", bg: "#ecfdf5" },
    risky: { icon: AlertTriangle, text: "Risky", color: "#d97706", bg: "#fffbeb" },
    invalid: { icon: XCircle, text: "Invalid", color: "#ef4444", bg: "#fef2f2" },
    unknown: { icon: HelpCircle, text: "Unverified", color: "#9ca3af", bg: "#f9fafb" },
  };

  const copyToClipboard = (text: string, id?: string) => {
    const doCopy = () => {
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(doCopy).catch(() => { fallbackCopy(text); doCopy(); });
    } else {
      fallbackCopy(text);
      doCopy();
    }
  };

  const fallbackCopy = (text: string) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
  };

  const handleStatusChange = (newStatus: string) => {
    statusMutation.mutate(newStatus);
    setOpenStatusDropdown(false);
  };

  // Loading / error / empty states
  if (!submissionId) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
        <button onClick={() => onNavigate("job-history")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#7c3aed", cursor: "pointer", border: "none", background: "none", padding: 0, fontFamily: "inherit", marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back to Job History
        </button>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 48, textAlign: "center", color: "#9ca3af" }}>
          No submission selected. Please choose a job from history.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 80 }}>
          <Loader2 size={28} style={{ color: "#7c3aed", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading job details...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
        <button onClick={() => onNavigate("job-history")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#7c3aed", cursor: "pointer", border: "none", background: "none", padding: 0, fontFamily: "inherit", marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back to Job History
        </button>
        <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 12, padding: 48, textAlign: "center", color: "#ef4444" }}>
          Failed to load submission details
        </div>
      </div>
    );
  }

  // Data setup
  const parsed = parseOpenAIData(submission.openaiResponseRaw);
  const companyDesc = extractCompanyDescription(submission.jobInput, submission.companyName);
  const allContacts = submission.recruiters || [];
  const contactedContacts = allContacts.filter(c => c.contactStatus && c.contactStatus !== "not_contacted");
  const notContactedContacts = allContacts.filter(c => !c.contactStatus || c.contactStatus === "not_contacted");

  const filteredContacts = allContacts.filter(c => {
    if (activeFilter === "all") return true;
    if (activeFilter === "recruiter") return c.outreachBucket === "recruiter";
    if (activeFilter === "hiring-manager") return c.outreachBucket === "department_lead";
    return true;
  });

  const validContacts = allContacts.filter(c => c.verificationStatus === "valid").length;
  const recruiters = allContacts.filter(c => c.outreachBucket === "recruiter").length;
  const hiringManagers = allContacts.filter(c => c.outreachBucket === "department_lead").length;

  const selectedContactData = selectedContact ? allContacts.find(c => c.id === selectedContact) : null;

  const LEGACY_STATUS_MAP: Record<string, string> = {
    "not_contacted": "saved",
    "email_sent": "reaching_out",
    "awaiting_reply": "reaching_out",
    "follow_up_needed": "reaching_out",
    "interview_scheduled": "interviewing",
    "rejected": "closed",
  };
  const statusOptions = [
    { display: "Saved", value: "saved", dot: "#94a3b8", bg: "#f8fafc", color: "#64748b" },
    { display: "Applied", value: "applied", dot: "#3b82f6", bg: "#eff6ff", color: "#2563eb" },
    { display: "Reaching Out", value: "reaching_out", dot: "#f59e0b", bg: "#fffbeb", color: "#d97706" },
    { display: "In Conversation", value: "in_conversation", dot: "#8b5cf6", bg: "#f5f3ff", color: "#7c3aed" },
    { display: "Interviewing", value: "interviewing", dot: "#10b981", bg: "#ecfdf5", color: "#059669" },
    { display: "Closed", value: "closed", dot: "#94a3b8", bg: "#f8fafc", color: "#94a3b8" },
  ];
  const normalizedStatus = LEGACY_STATUS_MAP[submission.status] || (statusOptions.some(s => s.value === submission.status) ? submission.status : "saved");
  const currentStatusOpt = statusOptions.find(s => s.value === normalizedStatus) || statusOptions[0];

  const companyWebsite = submission.companyDomain
    ? `https://${submission.companyDomain.replace(/^https?:\/\//, "")}`
    : null;

  const rawJD = submission.jobInput || "";
  const hasResponsibilities = parsed.responsibilities.length > 0;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 60px", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", color: "#111827", minHeight: "100vh" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .jd-card { transition: all 0.2s ease; border: 1px solid transparent; }
        .jd-card:hover { border-color: #e0e0e6; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .jd-action { transition: all 0.15s ease; }
        .jd-action:hover { background: #f5f3ff !important; color: #7c3aed !important; }
        .jd-contact-row { transition: background 0.15s ease; }
        .jd-contact-row:hover { background: #fafafe; }
      `}</style>

      {/* Back nav */}
      <button
        onClick={() => onNavigate("job-history")}
        className="jd-action"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#6b7280", cursor: "pointer", border: "none", background: "none", padding: "4px 0", fontFamily: "inherit", marginBottom: 20 }}
      >
        <ArrowLeft size={15} /> Job History
      </button>

      {/* ═══ HEADER ═══ */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1.25, margin: 0, letterSpacing: "-0.03em" }}>
              {submission.jobTitle || "Untitled Position"}
            </h1>
          </div>

          {/* Status pill */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
              disabled={statusMutation.isPending}
              className="jd-action"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px",
                borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: "pointer", border: `1.5px solid ${currentStatusOpt.dot}30`,
                background: currentStatusOpt.bg, color: currentStatusOpt.color,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: currentStatusOpt.dot }} />
              {statusMutation.isPending ? "..." : currentStatusOpt.display}
              <ChevronDown size={13} />
            </button>
            {openStatusDropdown && (
              <>
                <div onClick={() => setOpenStatusDropdown(false)} style={{ position: "fixed", inset: 0, zIndex: 19 }} />
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#fff", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)", zIndex: 20, minWidth: 180, padding: 4 }}>
                  {statusOptions.map(s => (
                    <button
                      key={s.value}
                      onClick={() => handleStatusChange(s.value)}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "inherit", border: "none", background: normalizedStatus === s.value ? "#f5f3ff" : "transparent", cursor: "pointer", borderRadius: 8, color: normalizedStatus === s.value ? "#7c3aed" : "#374151", fontWeight: normalizedStatus === s.value ? 600 : 400, textAlign: "left" }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />
                      {s.display}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#374151", fontWeight: 600 }}>
            <Building2 size={15} style={{ color: "#7c3aed" }} />
            {submission.companyName || "Unknown Company"}
          </div>
          {parsed.location && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#6b7280" }}>
              <MapPin size={14} />
              {parsed.location}
            </div>
          )}
          {parsed.department && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#6b7280" }}>
              <Briefcase size={14} />
              {parsed.department}
            </div>
          )}
          {companyWebsite && (
            <a href={companyWebsite} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#7c3aed", textDecoration: "none", fontWeight: 500 }}>
              <Globe size={14} />
              {submission.companyDomain}
            </a>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#9ca3af" }}>
            <Calendar size={14} />
            {formatDate(submission.submittedAt)}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#f0f0f3", marginTop: 20 }} />
      </div>

      {/* ═══ STATS ROW ═══ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[
          { label: "Contacts", value: allContacts.length, color: "#7c3aed" },
          { label: "Verified", value: validContacts, color: "#059669" },
          { label: "Recruiters", value: recruiters, color: "#3b82f6" },
          { label: "Hiring Mgrs", value: hiringManagers, color: "#0891b2" },
          ...(contactedContacts.length > 0 ? [{ label: "Reached Out", value: contactedContacts.length, color: "#f59e0b" }] : []),
        ].map((stat, i) => (
          <div key={i} style={{ flex: 1, padding: "14px 16px", background: "#fafafe", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, lineHeight: 1, letterSpacing: "-0.03em" }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 28, alignItems: "start" }}>

        {/* ── LEFT: People ── */}
        <div>
          {/* Section header + filters */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
              People
            </h2>
            <div style={{ display: "flex", gap: 2, background: "#f3f4f6", borderRadius: 8, padding: 2 }}>
              {[
                { key: "all", label: "All" },
                { key: "recruiter", label: "Recruiters" },
                { key: "hiring-manager", label: "Hiring Mgrs" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: activeFilter === f.key ? 600 : 500,
                    fontFamily: "inherit",
                    border: "none",
                    cursor: "pointer",
                    background: activeFilter === f.key ? "#fff" : "transparent",
                    color: activeFilter === f.key ? "#111827" : "#6b7280",
                    boxShadow: activeFilter === f.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact list */}
          {filteredContacts.length === 0 ? (
            <div style={{ background: "#fafafe", borderRadius: 12, padding: "48px 20px", textAlign: "center" }}>
              <Users size={24} style={{ color: "#d1d5db", marginBottom: 8 }} />
              <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>No contacts found</p>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              {filteredContacts.map((contact, idx) => {
                const vs = contact.verificationStatus || "unknown";
                const cfg = emailStatusConfig[vs] || emailStatusConfig.unknown;
                const StatusIcon = cfg.icon;
                const matchInfo = getMatchInfo(contact);
                const hasMessages = contact.emailDraft || contact.linkedinMessage;
                const isGenerating = generatingMessageFor === contact.id;
                const isContacted = contact.contactStatus && contact.contactStatus !== "not_contacted";
                const seniorityLabel = formatSeniority(contact.seniority);
                const isExpanded = expandedContact === contact.id;
                const isLast = idx === filteredContacts.length - 1;

                const bucketLabel = contact.outreachBucket === "department_lead" ? "Hiring Mgr" : "Recruiter";

                return (
                  <div key={contact.id}>
                    <div
                      className="jd-contact-row"
                      style={{
                        padding: "16px 20px",
                        cursor: "pointer",
                        borderBottom: isLast && !isExpanded ? "none" : "1px solid #f3f4f6",
                        animation: "fadeUp 0.3s ease both",
                        animationDelay: `${idx * 40}ms`,
                      }}
                      onClick={() => setExpandedContact(isExpanded ? null : contact.id)}
                    >
                      {/* Main row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        {/* Avatar */}
                        <div style={{
                          width: 42, height: 42, borderRadius: 21, flexShrink: 0,
                          background: contact.outreachBucket === "department_lead"
                            ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                            : "linear-gradient(135deg, #a78bfa, #7c3aed)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.02em",
                        }}>
                          {getInitials(contact.name)}
                        </div>

                        {/* Name + title */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 650, color: "#111827" }}>
                              {contact.name || "Unknown"}
                            </span>
                            {contact.linkedinUrl && (
                              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="LinkedIn">
                                <Linkedin size={14} style={{ color: "#0a66c2", opacity: 0.7 }} />
                              </a>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 1 }}>
                            {contact.title || "No title"}
                          </div>
                        </div>

                        {/* Right side: type + match + verification */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          {/* Bucket type */}
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5,
                            background: contact.outreachBucket === "department_lead" ? "#ecfeff" : "#f5f3ff",
                            color: contact.outreachBucket === "department_lead" ? "#0891b2" : "#7c3aed",
                            textTransform: "uppercase", letterSpacing: "0.03em",
                          }}>
                            {bucketLabel}
                          </span>

                          {/* Match quality dot */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }} title={matchInfo.label}>
                            <span style={{ width: 6, height: 6, borderRadius: 3, background: matchInfo.dotColor }} />
                            <span style={{ fontSize: 11, color: matchInfo.color, fontWeight: 500 }}>{matchInfo.label}</span>
                          </div>

                          {/* Email verification */}
                          {contact.email && (
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }} title={`Email: ${cfg.text}`}>
                              <StatusIcon size={13} style={{ color: cfg.color }} />
                            </div>
                          )}

                          {/* Contacted badge */}
                          {isContacted && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "#ecfdf5", padding: "2px 7px", borderRadius: 4 }}>Sent</span>
                          )}

                          {/* Expand chevron */}
                          <ChevronRight size={14} style={{ color: "#d1d5db", transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "none" }} />
                        </div>
                      </div>
                    </div>

                    {/* Expanded section */}
                    {isExpanded && (
                      <div style={{ padding: "0 20px 18px", paddingLeft: 76, borderBottom: isLast ? "none" : "1px solid #f3f4f6", animation: "fadeUp 0.2s ease" }}>
                        {/* Details row */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                          {seniorityLabel && (
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              <span style={{ color: "#9ca3af" }}>Seniority:</span> {seniorityLabel}
                            </span>
                          )}
                          {contact.department && (
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              <span style={{ color: "#9ca3af" }}>Dept:</span> {contact.department}
                            </span>
                          )}
                        </div>

                        {/* Email */}
                        {contact.email && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                            <div style={{
                              display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "8px 12px",
                              background: "#f9fafb", borderRadius: 8, border: "1px solid #f0f0f3",
                            }}>
                              <Mail size={13} style={{ color: "#9ca3af", flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: "#374151", fontFamily: "'SF Mono', 'Fira Code', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {contact.email}
                              </span>
                              <span style={{ fontSize: 11, color: cfg.color, fontWeight: 500, marginLeft: "auto", flexShrink: 0 }}>
                                {cfg.text}
                              </span>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); copyToClipboard(contact.email!, `email-${contact.id}`); }}
                              title="Copy email"
                              style={{ padding: 7, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.15s" }}
                            >
                              {copiedId === `email-${contact.id}` ? <Check size={13} style={{ color: "#059669" }} /> : <Copy size={13} style={{ color: "#9ca3af" }} />}
                            </button>
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {!hasMessages ? (
                            <button
                              disabled={isGenerating}
                              onClick={e => { e.stopPropagation(); generateMessageMutation.mutate(contact.id); }}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                                borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                                cursor: isGenerating ? "default" : "pointer", border: "none",
                                background: "#111827", color: "#fff",
                                opacity: isGenerating ? 0.7 : 1,
                              }}
                            >
                              {isGenerating ? (
                                <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Drafting...</>
                              ) : (
                                <><Sparkles size={13} /> Draft Messages</>
                              )}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedContact(contact.id); }}
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151" }}
                              >
                                <Eye size={13} /> View
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); copyToClipboard(contact.emailDraft || "", `draft-${contact.id}`); }}
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151" }}
                              >
                                {copiedId === `draft-${contact.id}` ? <><Check size={13} style={{ color: "#059669" }} /> Copied</> : <><Copy size={13} /> Copy Email</>}
                              </button>
                            </>
                          )}
                          {contact.linkedinUrl && (
                            <a
                              href={contact.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #dbeafe", background: "#fff", color: "#2563eb", textDecoration: "none" }}
                            >
                              <Linkedin size={13} /> Profile
                            </a>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); onNavigate("contact-detail", { contactId: contact.id }); }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", border: "none", background: "transparent", color: "#7c3aed", marginLeft: "auto" }}
                          >
                            Full Profile <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>

          {/* Quick Actions */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {notContactedContacts.length > 0 && (
                <button
                  onClick={() => setLogModalOpen(true)}
                  className="jd-action"
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", border: "none", background: "transparent", color: "#374151", textAlign: "left" }}
                >
                  <Send size={14} style={{ color: "#7c3aed" }} /> Log Outreach
                </button>
              )}
              <button
                className="jd-action"
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", border: "none", background: "transparent", color: "#374151", textAlign: "left" }}
              >
                <Plus size={14} style={{ color: "#7c3aed" }} /> Pull More Contacts
              </button>
            </div>
          </div>

          {/* Notes */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Notes</div>
            <textarea
              placeholder="Add notes..."
              value={notesValue}
              onChange={e => { setNotesValue(e.target.value); setNotesDirty(true); }}
              style={{ width: "100%", minHeight: 72, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: "#374151", resize: "vertical", outline: "none", lineHeight: 1.5, boxSizing: "border-box", transition: "border-color 0.15s" }}
              onFocus={e => { e.target.style.borderColor = "#c4b5fd"; }}
              onBlur={e => { e.target.style.borderColor = "#e5e7eb"; }}
            />
            {notesDirty && (
              <button
                onClick={() => notesMutation.mutate(notesValue)}
                disabled={notesMutation.isPending}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "#111827", color: "#fff", marginTop: 8 }}
              >
                <Save size={12} />
                {notesMutation.isPending ? "Saving..." : "Save"}
              </button>
            )}
          </div>

          {/* Outreach Activity */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Activity</div>
            {contactedContacts.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {contactedContacts.map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#374151" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "#f0fdf4", flexShrink: 0,
                    }}>
                      <Check size={13} style={{ color: "#059669" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "Unknown"}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
                      {c.lastContactedAt ? timeAgo(c.lastContactedAt) : "Sent"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No outreach logged yet</p>
            )}
          </div>

          {/* Job Description */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <div
              onClick={() => setShowResponsibilities(!showResponsibilities)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", userSelect: "none" }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Job Details</span>
              <ChevronRight size={14} style={{ color: "#d1d5db", transition: "transform 0.15s", transform: showResponsibilities ? "rotate(90deg)" : "none" }} />
            </div>

            {showResponsibilities && (
              <div style={{ padding: "0 16px 16px", fontSize: 13, color: "#4b5563", lineHeight: 1.65 }}>
                {parsed.summary && (
                  <p style={{ margin: "0 0 12px", color: "#374151" }}>{parsed.summary}</p>
                )}
                {hasResponsibilities && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Responsibilities</div>
                    <ul style={{ paddingLeft: 16, margin: "0 0 12px" }}>
                      {parsed.responsibilities.slice(0, showFullJD ? undefined : 3).map((r, i) => <li key={i} style={{ marginBottom: 4, fontSize: 12.5 }}>{r}</li>)}
                    </ul>
                  </>
                )}
                {parsed.requirements.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, marginTop: 10 }}>Requirements</div>
                    <ul style={{ paddingLeft: 16, margin: 0 }}>
                      {parsed.requirements.slice(0, showFullJD ? undefined : 3).map((r, i) => <li key={i} style={{ marginBottom: 4, fontSize: 12.5 }}>{r}</li>)}
                    </ul>
                  </>
                )}
                {!hasResponsibilities && !parsed.summary && (
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 12.5 }}>
                    {showFullJD ? rawJD : (rawJD.length > 200 ? rawJD.slice(0, 200) + "..." : rawJD)}
                  </div>
                )}
                {(hasResponsibilities || rawJD.length > 200) && (
                  <button
                    onClick={() => setShowFullJD(!showFullJD)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, fontWeight: 500, color: "#7c3aed", cursor: "pointer", background: "none", border: "none", padding: 0, fontFamily: "inherit" }}
                  >
                    {showFullJD ? "Show less" : "Show all"} <ChevronDown size={12} style={showFullJD ? { transform: "rotate(180deg)" } : {}} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* About Company */}
          {companyDesc && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <div
                onClick={() => setShowCompanyDesc(!showCompanyDesc)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer", userSelect: "none" }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>About {submission.companyName || "Company"}</span>
                <ChevronRight size={14} style={{ color: "#d1d5db", transition: "transform 0.15s", transform: showCompanyDesc ? "rotate(90deg)" : "none" }} />
              </div>
              {showCompanyDesc && (
                <div style={{ padding: "0 16px 16px", fontSize: 13, color: "#4b5563", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {companyDesc}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ LOG OUTREACH MODAL ═══ */}
      {logModalOpen && (
        <div onClick={() => setLogModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, marginTop: 0 }}>Log Outreach</h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Select contact to mark as emailed</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {notContactedContacts.map(c => (
                <div
                  key={c.id}
                  onClick={() => setLogSelectedContact(c.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    border: `1.5px solid ${logSelectedContact === c.id ? "#7c3aed" : "#e5e7eb"}`,
                    borderRadius: 10, cursor: "pointer",
                    background: logSelectedContact === c.id ? "#faf5ff" : "#fff",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
                    background: logSelectedContact === c.id ? "#7c3aed" : "#f3f4f6",
                    color: logSelectedContact === c.id ? "#fff" : "#9ca3af",
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {getInitials(c.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{c.name || "Unknown"}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.title || ""}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setLogModalOpen(false)}
                style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151" }}
              >
                Cancel
              </button>
              <button
                disabled={!logSelectedContact || logOutreachMutation.isPending}
                onClick={() => logSelectedContact && logOutreachMutation.mutate(logSelectedContact)}
                style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "#111827", color: "#fff", opacity: !logSelectedContact ? 0.4 : 1 }}
              >
                {logOutreachMutation.isPending ? "Saving..." : "Mark Sent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MESSAGE PREVIEW MODAL ═══ */}
      {selectedContact && selectedContactData && (
        <div onClick={() => setSelectedContact(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.15)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #f3f4f6" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>{selectedContactData.name}</h3>
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2, marginBottom: 0 }}>{selectedContactData.title}</p>
              </div>
              <button onClick={() => setSelectedContact(null)} style={{ background: "#f3f4f6", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex" }}>
                <X size={16} style={{ color: "#6b7280" }} />
              </button>
            </div>

            {/* Content */}
            <div style={{ overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {selectedContactData.emailDraft && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <Mail size={13} style={{ color: "#7c3aed" }} /> Email
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedContactData.emailDraft || "", `modal-email-${selectedContactData.id}`)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 11, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280", fontFamily: "inherit", fontWeight: 500 }}
                    >
                      {copiedId === `modal-email-${selectedContactData.id}` ? <><Check size={11} style={{ color: "#059669" }} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                  </div>
                  <div style={{ padding: 18, fontSize: 13.5, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.7, background: "#f9fafb", borderRadius: 10, border: "1px solid #f0f0f3" }}>
                    {selectedContactData.emailDraft}
                  </div>
                </div>
              )}

              {selectedContactData.linkedinMessage && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <Linkedin size={13} style={{ color: "#0a66c2" }} /> LinkedIn
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedContactData.linkedinMessage || "", `modal-li-${selectedContactData.id}`)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, fontSize: 11, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280", fontFamily: "inherit", fontWeight: 500 }}
                    >
                      {copiedId === `modal-li-${selectedContactData.id}` ? <><Check size={11} style={{ color: "#059669" }} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                  </div>
                  <div style={{ padding: 18, fontSize: 13.5, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.7, background: "#f9fafb", borderRadius: 10, border: "1px solid #f0f0f3" }}>
                    {selectedContactData.linkedinMessage}
                  </div>
                </div>
              )}

              {!selectedContactData.emailDraft && !selectedContactData.linkedinMessage && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <Sparkles size={24} style={{ color: "#d1d5db", marginBottom: 12 }} />
                  <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 16 }}>No messages generated yet</p>
                  <button
                    disabled={generatingMessageFor === selectedContactData.id}
                    onClick={() => generateMessageMutation.mutate(selectedContactData.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "#111827", color: "#fff" }}
                  >
                    {generatingMessageFor === selectedContactData.id ? (
                      <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
                    ) : (
                      <><Sparkles size={13} /> Generate Messages</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #f3f4f6" }}>
              <button
                onClick={() => setSelectedContact(null)}
                style={{ width: "100%", padding: 11, borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
