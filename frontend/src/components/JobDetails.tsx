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

/** Juicebox-inspired relevance label based on bucket + seniority */
function getRelevanceLabel(contact: Recruiter): { label: string; color: string; bg: string } {
  if (contact.outreachBucket === "department_lead") {
    if (contact.seniority && /director|vp|head|c_suite|chief/i.test(contact.seniority)) {
      return { label: "Strong Match", color: "#059669", bg: "#ecfdf5" };
    }
    return { label: "Good Fit", color: "#0891b2", bg: "#ecfeff" };
  }
  if (contact.seniority && /senior|lead|head/i.test(contact.seniority)) {
    return { label: "Good Fit", color: "#7c3aed", bg: "#f5f3ff" };
  }
  return { label: "Potential", color: "#6b7280", bg: "#f3f4f6" };
}

/** Generate a short relevance reason */
function getRelevanceReason(contact: Recruiter, jobTitle: string | null, companyName: string | null): string {
  const bucket = contact.outreachBucket === "department_lead" ? "hiring manager" : "recruiter";
  const dept = contact.department ? ` in ${contact.department}` : "";
  const seniority = contact.seniority ? `${contact.seniority.replace(/_/g, " ")} ` : "";
  return `${seniority}${bucket}${dept} at ${companyName || "this company"}`;
}

/** Seniority display label */
function formatSeniority(s: string | null): string | null {
  if (!s) return null;
  const map: Record<string, string> = {
    c_suite: "C-Suite", vp: "VP", director: "Director", head: "Head",
    lead: "Lead", senior: "Senior", manager: "Manager", entry: "Entry",
  };
  return map[s.toLowerCase()] || s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
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
  const [hoveredContact, setHoveredContact] = useState<number | null>(null);

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
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
        <button
          onClick={() => onNavigate("job-history")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#7c3aed", cursor: "pointer", border: "none", background: "none", padding: 0, fontFamily: "inherit", marginBottom: 16 }}
        >
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
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
        <button
          onClick={() => onNavigate("job-history")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#7c3aed", cursor: "pointer", border: "none", background: "none", padding: 0, fontFamily: "inherit", marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back to Job History
        </button>
        <div style={{ textAlign: "center", padding: 64 }}>
          <Loader2 size={32} style={{ color: "#7c3aed", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading job details...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
        <button
          onClick={() => onNavigate("job-history")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#7c3aed", cursor: "pointer", border: "none", background: "none", padding: 0, fontFamily: "inherit", marginBottom: 16 }}
        >
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
    { display: "Saved", value: "saved", dot: "#6b7280", bg: "#f3f4f6", color: "#6b7280" },
    { display: "Applied", value: "applied", dot: "#2563eb", bg: "#eff6ff", color: "#2563eb" },
    { display: "Reaching Out", value: "reaching_out", dot: "#d97706", bg: "#fffbeb", color: "#d97706" },
    { display: "In Conversation", value: "in_conversation", dot: "#7c3aed", bg: "#f5f3ff", color: "#7c3aed" },
    { display: "Interviewing", value: "interviewing", dot: "#059669", bg: "#ecfdf5", color: "#059669" },
    { display: "Closed", value: "closed", dot: "#9ca3af", bg: "#f9fafb", color: "#9ca3af" },
  ];
  const normalizedStatus = LEGACY_STATUS_MAP[submission.status] || (statusOptions.some(s => s.value === submission.status) ? submission.status : "saved");
  const currentStatusOpt = statusOptions.find(s => s.value === normalizedStatus) || statusOptions[0];

  const companyWebsite = submission.companyDomain
    ? `https://${submission.companyDomain.replace(/^https?:\/\//, "")}`
    : null;

  const rawJD = submission.jobInput || "";
  const hasResponsibilities = parsed.responsibilities.length > 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", color: "#1e1e2d", minHeight: "100vh" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .jd2-contact-card { transition: all 0.2s ease; }
        .jd2-contact-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(124, 58, 237, 0.1); border-color: #c4b5fd !important; }
        .jd2-btn { transition: all 0.15s ease; }
        .jd2-btn:hover { transform: translateY(-1px); }
        .jd2-filter-pill { transition: all 0.15s ease; }
        .jd2-filter-pill:hover { background: #ede9fe !important; color: #7c3aed !important; }
        .jd2-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => onNavigate("job-history")}
          className="jd2-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#7c3aed", cursor: "pointer", border: "none", background: "none", padding: 0, fontFamily: "inherit", marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> Back to Job History
        </button>

        {/* Hero card */}
        <div style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #e0e7ff 100%)", borderRadius: 16, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, background: "rgba(124, 58, 237, 0.06)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: -20, right: 60, width: 80, height: 80, background: "rgba(124, 58, 237, 0.04)", borderRadius: "50%" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", position: "relative" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1e1e2d", lineHeight: 1.2, margin: 0, letterSpacing: "-0.02em" }}>
                {submission.jobTitle || "Untitled Position"}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, color: "#4b5563", fontWeight: 500 }}>
                  <Building2 size={15} style={{ color: "#7c3aed" }} />
                  {submission.companyName || "Unknown Company"}
                </div>
                {parsed.location && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#6b7280" }}>
                    <MapPin size={14} style={{ color: "#9ca3af" }} />
                    {parsed.location}
                  </div>
                )}
                {parsed.department && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#6b7280" }}>
                    <Briefcase size={14} style={{ color: "#9ca3af" }} />
                    {parsed.department}
                  </div>
                )}
                {companyWebsite && (
                  <a href={companyWebsite} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#7c3aed", textDecoration: "none" }}>
                    <ExternalLink size={14} />
                    {submission.companyDomain}
                  </a>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#9ca3af" }}>
                  <Calendar size={14} />
                  {formatDate(submission.submittedAt)}
                </div>
              </div>
            </div>

            {/* Status dropdown */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
                disabled={statusMutation.isPending}
                className="jd2-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: currentStatusOpt.bg, color: currentStatusOpt.color, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: currentStatusOpt.dot }} />
                {statusMutation.isPending ? "Updating..." : currentStatusOpt.display}
                <ChevronDown size={14} />
              </button>
              {openStatusDropdown && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", zIndex: 20, minWidth: 200, padding: 6 }}>
                  {statusOptions.map(s => (
                    <button
                      key={s.value}
                      onClick={() => handleStatusChange(s.value)}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", fontSize: 13, fontFamily: "inherit", border: "none", background: normalizedStatus === s.value ? "#f5f3ff" : "none", cursor: "pointer", borderRadius: 8, color: normalizedStatus === s.value ? "#7c3aed" : "#4b5563", fontWeight: normalizedStatus === s.value ? 600 : 400, textAlign: "left" }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot }} />
                      {s.display}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ STATS STRIP ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${contactedContacts.length > 0 ? 5 : 4}, 1fr)`, gap: 12, marginBottom: 24 }}>
        {[
          { icon: Users, label: "Total", value: allContacts.length, gradient: "linear-gradient(135deg, #f0f0ff, #e8e0ff)", iconColor: "#7c3aed" },
          { icon: CheckCircle, label: "Verified", value: validContacts, gradient: "linear-gradient(135deg, #ecfdf5, #d1fae5)", iconColor: "#059669" },
          { icon: UserCheck, label: "Recruiters", value: recruiters, gradient: "linear-gradient(135deg, #f5f3ff, #ede9fe)", iconColor: "#7c3aed" },
          { icon: TrendingUp, label: "Hiring Mgrs", value: hiringManagers, gradient: "linear-gradient(135deg, #ecfeff, #cffafe)", iconColor: "#0891b2" },
          ...(contactedContacts.length > 0 ? [{ icon: Mail, label: "Contacted", value: contactedContacts.length, gradient: "linear-gradient(135deg, #fffbeb, #fef3c7)", iconColor: "#d97706" }] : []),
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} style={{ background: stat.gradient, borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, border: "1px solid rgba(0,0,0,0.04)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={18} style={{ color: stat.iconColor }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1e1e2d", lineHeight: 1, letterSpacing: "-0.02em" }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginTop: 2 }}>{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "start" }}>

        {/* ── LEFT: Contact Cards ── */}
        <div>
          {/* Filter bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e1e2d", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={18} style={{ color: "#7c3aed" }} />
              Contacts
              <span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>({filteredContacts.length})</span>
            </h2>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { key: "all", label: "All", count: allContacts.length },
                { key: "recruiter", label: "Recruiters", count: recruiters },
                { key: "hiring-manager", label: "Hiring Mgrs", count: hiringManagers },
              ].map(f => (
                <button
                  key={f.key}
                  className="jd2-filter-pill"
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: activeFilter === f.key ? 600 : 500,
                    fontFamily: "inherit",
                    border: "none",
                    cursor: "pointer",
                    background: activeFilter === f.key ? "#7c3aed" : "#f3f4f6",
                    color: activeFilter === f.key ? "#fff" : "#6b7280",
                  }}
                >
                  {f.label} · {f.count}
                </button>
              ))}
            </div>
          </div>

          {/* Contact list */}
          {filteredContacts.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: "48px 20px", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, margin: "0 auto 14px", background: "#f3f4f6", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={24} style={{ color: "#9ca3af" }} />
              </div>
              <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>No contacts found</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredContacts.map(contact => {
                const vs = contact.verificationStatus || "unknown";
                const cfg = emailStatusConfig[vs] || emailStatusConfig.unknown;
                const StatusIcon = cfg.icon;
                const relevance = getRelevanceLabel(contact);
                const reason = getRelevanceReason(contact, submission.jobTitle, submission.companyName);
                const hasMessages = contact.emailDraft || contact.linkedinMessage;
                const isGenerating = generatingMessageFor === contact.id;
                const isContacted = contact.contactStatus && contact.contactStatus !== "not_contacted";
                const isHovered = hoveredContact === contact.id;
                const seniorityLabel = formatSeniority(contact.seniority);

                const avatarGradient = contact.outreachBucket === "department_lead"
                  ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                  : "linear-gradient(135deg, #8b5cf6, #7c3aed)";

                return (
                  <div
                    key={contact.id}
                    className="jd2-contact-card"
                    onMouseEnter={() => setHoveredContact(contact.id)}
                    onMouseLeave={() => setHoveredContact(null)}
                    onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                    style={{
                      background: "#fff",
                      border: "1px solid #e8eaed",
                      borderRadius: 14,
                      padding: "18px 20px",
                      cursor: "pointer",
                      animation: "fadeIn 0.3s ease",
                    }}
                  >
                    {/* Row 1: Avatar + Name + Relevance badge */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, background: avatarGradient,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(124, 58, 237, 0.2)",
                      }}>
                        {getInitials(contact.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#1e1e2d" }}>
                            {contact.name || "Unknown"}
                          </span>
                          {contact.linkedinUrl && (
                            <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="View LinkedIn">
                              <Linkedin size={15} style={{ color: "#0a66c2" }} />
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                          {contact.title || "No title"}
                        </div>
                        {/* AI relevance reason — Juicebox-style */}
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, fontStyle: "italic" }}>
                          {reason}
                        </div>
                      </div>
                      {/* Relevance badge */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: relevance.bg, color: relevance.color,
                        }}>
                          <Star size={12} />
                          {relevance.label}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Tags — seniority, department, bucket, verification */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingLeft: 58 }}>
                      <span className="jd2-tag" style={{ background: contact.outreachBucket === "department_lead" ? "#ecfeff" : "#f5f3ff", color: contact.outreachBucket === "department_lead" ? "#0891b2" : "#7c3aed" }}>
                        <Tag size={10} />
                        {contact.outreachBucket === "department_lead" ? "Hiring Manager" : "Recruiter"}
                      </span>
                      {seniorityLabel && (
                        <span className="jd2-tag" style={{ background: "#f0fdf4", color: "#15803d" }}>
                          {seniorityLabel}
                        </span>
                      )}
                      {contact.department && (
                        <span className="jd2-tag" style={{ background: "#fff7ed", color: "#c2410c" }}>
                          {contact.department}
                        </span>
                      )}
                      <span className="jd2-tag" style={{ background: cfg.bg, color: cfg.color }}>
                        <StatusIcon size={10} />
                        {cfg.text}
                      </span>
                      {isContacted && (
                        <span className="jd2-tag" style={{ background: "#ecfdf5", color: "#059669" }}>
                          <Check size={10} />
                          Contacted
                        </span>
                      )}
                    </div>

                    {/* Row 3: Email */}
                    {contact.email && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingLeft: 58 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, padding: "8px 12px", background: "#fafbfc", borderRadius: 8, border: "1px solid #f0f0f3" }}>
                          <Mail size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "#4b5563", fontFamily: "'SF Mono', 'Fira Code', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {contact.email}
                          </span>
                        </div>
                        <button
                          className="jd2-btn"
                          onClick={e => { e.stopPropagation(); copyToClipboard(contact.email!, `email-${contact.id}`); }}
                          title="Copy email"
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}
                        >
                          {copiedId === `email-${contact.id}` ? <Check size={14} style={{ color: "#059669" }} /> : <Copy size={14} style={{ color: "#9ca3af" }} />}
                        </button>
                      </div>
                    )}

                    {/* Row 4: Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingLeft: 58 }}>
                      {!hasMessages ? (
                        <button
                          className="jd2-btn"
                          disabled={isGenerating}
                          onClick={e => { e.stopPropagation(); generateMessageMutation.mutate(contact.id); }}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                            borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                            cursor: isGenerating ? "default" : "pointer", border: "none",
                            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", color: "#fff",
                            opacity: isGenerating ? 0.7 : 1,
                            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
                          }}
                        >
                          {isGenerating ? (
                            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
                          ) : (
                            <><Sparkles size={14} /> Draft Messages</>
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            className="jd2-btn"
                            onClick={e => { e.stopPropagation(); setSelectedContact(contact.id); }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#4b5563" }}
                          >
                            <Eye size={13} /> View Messages
                          </button>
                          <button
                            className="jd2-btn"
                            onClick={e => { e.stopPropagation(); copyToClipboard(contact.emailDraft || "", `draft-${contact.id}`); }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#4b5563" }}
                          >
                            {copiedId === `draft-${contact.id}` ? <><Check size={13} style={{ color: "#059669" }} /> Copied!</> : <><Copy size={13} /> Copy Email</>}
                          </button>
                        </>
                      )}
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="jd2-btn"
                          onClick={e => e.stopPropagation()}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #0a66c2", background: "#fff", color: "#0a66c2", textDecoration: "none" }}
                        >
                          <Linkedin size={13} /> LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pull more contacts CTA */}
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              className="jd2-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "2px dashed #d4d0e8", background: "transparent", color: "#7c3aed" }}
            >
              <Plus size={15} /> Pull Additional Contacts
            </button>
          </div>
        </div>

        {/* ── RIGHT: Job Info + Notes + Outreach Log ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24, maxHeight: "calc(100vh - 72px)", overflowY: "auto" }}>

          {/* Notes */}
          <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#1e1e2d", marginBottom: 12 }}>
                <FileText size={16} style={{ color: "#7c3aed" }} />
                Notes
              </div>
              <textarea
                placeholder="Add notes about this application..."
                value={notesValue}
                onChange={e => { setNotesValue(e.target.value); setNotesDirty(true); }}
                style={{ width: "100%", minHeight: 80, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 13, fontFamily: "inherit", color: "#1e1e2d", resize: "vertical", outline: "none", lineHeight: 1.5, boxSizing: "border-box" }}
              />
              {notesDirty && (
                <button
                  onClick={() => notesMutation.mutate(notesValue)}
                  disabled={notesMutation.isPending}
                  className="jd2-btn"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "#7c3aed", color: "#fff", marginTop: 10 }}
                >
                  <Save size={13} />
                  {notesMutation.isPending ? "Saving..." : "Save Notes"}
                </button>
              )}
            </div>
          </div>

          {/* Outreach Log */}
          <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#1e1e2d", marginBottom: 12 }}>
                <Mail size={16} style={{ color: "#7c3aed" }} />
                Outreach Log
              </div>
              {contactedContacts.length > 0 ? (
                contactedContacts.map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#4b5563", padding: "10px 12px", background: "#fafbfc", borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#ede9fe", color: "#7c3aed", flexShrink: 0 }}>
                      <Mail size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#1e1e2d", fontSize: 13 }}>{c.name || "Unknown"}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.title || ""}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {c.lastContactedAt ? timeAgo(c.lastContactedAt) : "Contacted"}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0" }}>No outreach logged yet</p>
              )}
              {notContactedContacts.length > 0 && (
                <button
                  onClick={() => setLogModalOpen(true)}
                  className="jd2-btn"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: contactedContacts.length > 0 ? 8 : 4, fontSize: 13, fontWeight: 500, color: "#7c3aed", cursor: "pointer", background: "none", border: "none", padding: 0, fontFamily: "inherit" }}
                >
                  <Plus size={14} /> Log outreach
                </button>
              )}
            </div>
          </div>

          {/* Job Description */}
          <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
            <div
              onClick={() => setShowResponsibilities(!showResponsibilities)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#1e1e2d" }}>
                <Briefcase size={16} style={{ color: "#7c3aed" }} />
                Job Details
              </div>
              <ChevronRight size={16} style={{ color: "#9ca3af", transition: "transform 0.15s", transform: showResponsibilities ? "rotate(90deg)" : "none" }} />
            </div>

            {showResponsibilities && (
              <div style={{ padding: "0 20px 18px", fontSize: 13, color: "#4b5563", lineHeight: 1.65 }}>
                {parsed.summary && (
                  <p style={{ marginBottom: 12, color: "#4b5563" }}>{parsed.summary}</p>
                )}
                {hasResponsibilities && (
                  <>
                    <strong style={{ fontSize: 11, color: "#1e1e2d", textTransform: "uppercase", letterSpacing: "0.5px" }}>Key Responsibilities</strong>
                    <ul style={{ paddingLeft: 18, margin: "8px 0 0" }}>
                      {parsed.responsibilities.slice(0, showFullJD ? undefined : 4).map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}
                    </ul>
                  </>
                )}
                {parsed.requirements.length > 0 && (
                  <>
                    <strong style={{ fontSize: 11, color: "#1e1e2d", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginTop: 14 }}>Requirements</strong>
                    <ul style={{ paddingLeft: 18, margin: "8px 0 0" }}>
                      {parsed.requirements.slice(0, showFullJD ? undefined : 4).map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}
                    </ul>
                  </>
                )}
                {!hasResponsibilities && !parsed.summary && (
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {showFullJD ? rawJD : (rawJD.length > 300 ? rawJD.slice(0, 300) + "..." : rawJD)}
                  </div>
                )}
                {(hasResponsibilities || rawJD.length > 300) && (
                  <button
                    onClick={() => setShowFullJD(!showFullJD)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 13, fontWeight: 500, color: "#7c3aed", cursor: "pointer", background: "none", border: "none", padding: 0, fontFamily: "inherit" }}
                  >
                    {showFullJD ? "Show less" : "Show all"} <ChevronDown size={14} style={showFullJD ? { transform: "rotate(180deg)" } : {}} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* About Company */}
          {companyDesc && (
            <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, overflow: "hidden" }}>
              <div
                onClick={() => setShowCompanyDesc(!showCompanyDesc)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", cursor: "pointer", userSelect: "none" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#1e1e2d" }}>
                  <Building2 size={16} style={{ color: "#7c3aed" }} />
                  About {submission.companyName || "Company"}
                </div>
                <ChevronRight size={16} style={{ color: "#9ca3af", transition: "transform 0.15s", transform: showCompanyDesc ? "rotate(90deg)" : "none" }} />
              </div>
              {showCompanyDesc && (
                <div style={{ padding: "0 20px 18px", fontSize: 13, color: "#4b5563", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {companyDesc}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ LOG OUTREACH MODAL ═══ */}
      {logModalOpen && (
        <div onClick={() => setLogModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: 24, boxShadow: "0 16px 48px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Log Outreach</h3>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>Select a contact to mark as emailed:</p>
            {notContactedContacts.map(c => (
              <div
                key={c.id}
                onClick={() => setLogSelectedContact(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                  border: `2px solid ${logSelectedContact === c.id ? "#7c3aed" : "#e5e7eb"}`,
                  borderRadius: 10, cursor: "pointer", marginBottom: 8,
                  background: logSelectedContact === c.id ? "#f5f3ff" : "#fff",
                  transition: "all 0.15s",
                }}
              >
                <Mail size={15} style={{ color: logSelectedContact === c.id ? "#7c3aed" : "#9ca3af" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.title || ""}</div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setLogModalOpen(false)}
                style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#4b5563" }}
              >
                Cancel
              </button>
              <button
                disabled={!logSelectedContact || logOutreachMutation.isPending}
                onClick={() => logSelectedContact && logOutreachMutation.mutate(logSelectedContact)}
                style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "#7c3aed", color: "#fff", opacity: !logSelectedContact ? 0.5 : 1 }}
              >
                {logOutreachMutation.isPending ? "Saving..." : "Mark as Emailed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MESSAGE PREVIEW MODAL ═══ */}
      {selectedContact && selectedContactData && (
        <div onClick={() => setSelectedContact(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 16px 48px rgba(0,0,0,0.15)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #f0f0f3" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Messages for {selectedContactData.name}</h3>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{selectedContactData.title}</p>
              </div>
              <button onClick={() => setSelectedContact(null)} style={{ background: "#f3f4f6", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex" }}>
                <X size={16} style={{ color: "#6b7280" }} />
              </button>
            </div>

            {/* Message content */}
            <div style={{ overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Email */}
              {selectedContactData.emailDraft && (
                <div style={{ border: "1px solid #e8eaed", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", borderBottom: "1px solid #e8eaed" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#1e1e2d" }}>
                      <Mail size={15} style={{ color: "#7c3aed" }} /> Email Draft
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedContactData.emailDraft || "", `modal-email-${selectedContactData.id}`)}
                      className="jd2-btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, fontSize: 12, border: "1px solid #d4d0e8", background: "#fff", cursor: "pointer", color: "#6b7280", fontFamily: "inherit", fontWeight: 500 }}
                    >
                      {copiedId === `modal-email-${selectedContactData.id}` ? <><Check size={12} style={{ color: "#059669" }} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                  <div style={{ padding: 18, fontSize: 13, color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                    {selectedContactData.emailDraft}
                  </div>
                </div>
              )}

              {/* LinkedIn */}
              {selectedContactData.linkedinMessage && (
                <div style={{ border: "1px solid #e8eaed", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "linear-gradient(135deg, #eff6ff, #dbeafe)", borderBottom: "1px solid #e8eaed" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#1e1e2d" }}>
                      <Linkedin size={15} style={{ color: "#0a66c2" }} /> LinkedIn Message
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedContactData.linkedinMessage || "", `modal-li-${selectedContactData.id}`)}
                      className="jd2-btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, fontSize: 12, border: "1px solid #bfdbfe", background: "#fff", cursor: "pointer", color: "#6b7280", fontFamily: "inherit", fontWeight: 500 }}
                    >
                      {copiedId === `modal-li-${selectedContactData.id}` ? <><Check size={12} style={{ color: "#059669" }} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                  <div style={{ padding: 18, fontSize: 13, color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                    {selectedContactData.linkedinMessage}
                  </div>
                </div>
              )}

              {/* No messages yet */}
              {!selectedContactData.emailDraft && !selectedContactData.linkedinMessage && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ width: 52, height: 52, margin: "0 auto 14px", background: "#f3f4f6", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sparkles size={24} style={{ color: "#9ca3af" }} />
                  </div>
                  <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 16 }}>No messages generated yet</p>
                  <button
                    className="jd2-btn"
                    disabled={generatingMessageFor === selectedContactData.id}
                    onClick={() => generateMessageMutation.mutate(selectedContactData.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", color: "#fff", boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)" }}
                  >
                    {generatingMessageFor === selectedContactData.id ? (
                      <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
                    ) : (
                      <><Sparkles size={14} /> Generate Messages</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #f0f0f3" }}>
              <button
                onClick={() => setSelectedContact(null)}
                style={{ width: "100%", padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "#7c3aed", color: "#fff" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
