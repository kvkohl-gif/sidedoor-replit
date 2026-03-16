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
  Send,
  Globe,
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
  const [showJobInfo, setShowJobInfo] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logSelectedContact, setLogSelectedContact] = useState<number | null>(null);
  const [generatingMessageFor, setGeneratingMessageFor] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedContact, setExpandedContact] = useState<number | null>(null);
  const [showNotes, setShowNotes] = useState(false);

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
      if (id) { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(doCopy).catch(() => { fallbackCopy(text); doCopy(); });
    } else { fallbackCopy(text); doCopy(); }
  };

  const fallbackCopy = (text: string) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
  };

  const handleStatusChange = (newStatus: string) => {
    statusMutation.mutate(newStatus);
    setOpenStatusDropdown(false);
  };

  // Loading / error / empty
  const shellStyle = { maxWidth: 960, margin: "0 auto", padding: "32px 24px", fontFamily: "'DM Sans', -apple-system, sans-serif" as const };

  if (!submissionId) {
    return (
      <div style={shellStyle}>
        <button onClick={() => onNavigate("job-history")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#6b7280", cursor: "pointer", border: "none", background: "none", padding: 0, fontFamily: "inherit", marginBottom: 16 }}>
          <ArrowLeft size={15} /> Job History
        </button>
        <div style={{ background: "#f9fafb", borderRadius: 12, padding: 48, textAlign: "center", color: "#9ca3af" }}>
          No submission selected.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={shellStyle}>
        <div style={{ textAlign: "center", padding: 80 }}>
          <Loader2 size={24} style={{ color: "#7c3aed", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div style={shellStyle}>
        <button onClick={() => onNavigate("job-history")} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#6b7280", cursor: "pointer", border: "none", background: "none", padding: 0, fontFamily: "inherit", marginBottom: 16 }}>
          <ArrowLeft size={15} /> Job History
        </button>
        <div style={{ background: "#fef2f2", borderRadius: 12, padding: 48, textAlign: "center", color: "#ef4444" }}>
          Failed to load submission details
        </div>
      </div>
    );
  }

  // Data
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
    "not_contacted": "saved", "email_sent": "reaching_out", "awaiting_reply": "reaching_out",
    "follow_up_needed": "reaching_out", "interview_scheduled": "interviewing", "rejected": "closed",
  };
  const statusOptions = [
    { display: "Saved", value: "saved", dot: "#94a3b8" },
    { display: "Applied", value: "applied", dot: "#3b82f6" },
    { display: "Reaching Out", value: "reaching_out", dot: "#f59e0b" },
    { display: "In Conversation", value: "in_conversation", dot: "#8b5cf6" },
    { display: "Interviewing", value: "interviewing", dot: "#10b981" },
    { display: "Closed", value: "closed", dot: "#94a3b8" },
  ];
  const normalizedStatus = LEGACY_STATUS_MAP[submission.status] || (statusOptions.some(s => s.value === submission.status) ? submission.status : "saved");
  const currentStatusOpt = statusOptions.find(s => s.value === normalizedStatus) || statusOptions[0];

  const companyWebsite = submission.companyDomain ? `https://${submission.companyDomain.replace(/^https?:\/\//, "")}` : null;
  const rawJD = submission.jobInput || "";
  const hasResponsibilities = parsed.responsibilities.length > 0;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 24px 80px", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", color: "#111827" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .jd-hover:hover { background: #f9fafb; }
        .jd-expand-row { transition: background 0.12s ease; cursor: pointer; }
        .jd-expand-row:hover { background: #fafafe; }
      `}</style>

      {/* ── BACK ── */}
      <button
        onClick={() => onNavigate("job-history")}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#6b7280", cursor: "pointer", border: "none", background: "none", padding: "4px 0", fontFamily: "inherit", marginBottom: 24 }}
      >
        <ArrowLeft size={15} /> Job History
      </button>

      {/* ════════════════════════════════════════════
          SECTION 1: JOB HEADER
         ════════════════════════════════════════════ */}
      <div style={{ marginBottom: 24 }}>
        {/* Title + status */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 12 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1.2, margin: 0, letterSpacing: "-0.03em", flex: 1 }}>
            {submission.jobTitle || "Untitled Position"}
          </h1>

          {/* Status */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
              disabled={statusMutation.isPending}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px",
                borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: "pointer", border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: currentStatusOpt.dot }} />
              {statusMutation.isPending ? "..." : currentStatusOpt.display}
              <ChevronDown size={13} style={{ color: "#9ca3af" }} />
            </button>
            {openStatusDropdown && (
              <>
                <div onClick={() => setOpenStatusDropdown(false)} style={{ position: "fixed", inset: 0, zIndex: 19 }} />
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#fff", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)", zIndex: 20, minWidth: 180, padding: 4 }}>
                  {statusOptions.map(s => (
                    <button key={s.value} onClick={() => handleStatusChange(s.value)}
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

        {/* Meta */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, color: "#374151", fontWeight: 600 }}>
            <Building2 size={15} style={{ color: "#7c3aed" }} />
            {submission.companyName || "Unknown"}
          </span>
          {parsed.location && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6b7280" }}>
              <MapPin size={14} /> {parsed.location}
            </span>
          )}
          {parsed.department && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6b7280" }}>
              <Briefcase size={14} /> {parsed.department}
            </span>
          )}
          {companyWebsite && (
            <a href={companyWebsite} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#7c3aed", textDecoration: "none", fontWeight: 500 }}>
              <Globe size={14} /> {submission.companyDomain}
            </a>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#9ca3af" }}>
            <Calendar size={14} /> {formatDate(submission.submittedAt)}
          </span>
        </div>

        {/* Inline stats */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { label: "Contacts", val: allContacts.length },
            { label: "Verified", val: validContacts },
            { label: "Recruiters", val: recruiters },
            { label: "Hiring Mgrs", val: hiringManagers },
            ...(contactedContacts.length > 0 ? [{ label: "Reached Out", val: contactedContacts.length }] : []),
          ].map((s, i) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", padding: "4px 10px", borderRadius: 6 }}>
              {s.val} {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          SECTION 2: COLLAPSIBLE JOB INFO + NOTES
         ════════════════════════════════════════════ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {/* Job Details toggle */}
        <button
          onClick={() => setShowJobInfo(!showJobInfo)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
            borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            cursor: "pointer", border: "1px solid #e5e7eb", background: showJobInfo ? "#f9fafb" : "#fff",
            color: "#374151",
          }}
        >
          <Briefcase size={14} style={{ color: "#7c3aed" }} />
          Job Details
          <ChevronDown size={13} style={{ color: "#9ca3af", transition: "transform 0.15s", transform: showJobInfo ? "rotate(180deg)" : "none" }} />
        </button>

        {/* Notes toggle */}
        <button
          onClick={() => setShowNotes(!showNotes)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
            borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            cursor: "pointer", border: "1px solid #e5e7eb", background: showNotes ? "#f9fafb" : "#fff",
            color: "#374151",
          }}
        >
          <FileText size={14} style={{ color: "#7c3aed" }} />
          Notes
          {submission.notes && <span style={{ width: 6, height: 6, borderRadius: 3, background: "#7c3aed" }} />}
          <ChevronDown size={13} style={{ color: "#9ca3af", transition: "transform 0.15s", transform: showNotes ? "rotate(180deg)" : "none" }} />
        </button>

        {/* Log outreach */}
        {notContactedContacts.length > 0 && (
          <button
            onClick={() => setLogModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
              borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151",
            }}
          >
            <Send size={14} style={{ color: "#7c3aed" }} />
            Log Outreach
          </button>
        )}
      </div>

      {/* Collapsible Job Details panel */}
      {showJobInfo && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 20, animation: "fadeUp 0.2s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: companyDesc ? "1fr 1fr" : "1fr", gap: 24 }}>
            {/* Left: JD content */}
            <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.65 }}>
              {parsed.summary && (
                <p style={{ margin: "0 0 14px", color: "#374151", fontSize: 14 }}>{parsed.summary}</p>
              )}
              {hasResponsibilities && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Responsibilities</div>
                  <ul style={{ paddingLeft: 16, margin: "0 0 14px" }}>
                    {parsed.responsibilities.slice(0, showFullJD ? undefined : 4).map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
                  </ul>
                </>
              )}
              {parsed.requirements.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Requirements</div>
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {parsed.requirements.slice(0, showFullJD ? undefined : 4).map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
                  </ul>
                </>
              )}
              {!hasResponsibilities && !parsed.summary && (
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {showFullJD ? rawJD : (rawJD.length > 400 ? rawJD.slice(0, 400) + "..." : rawJD)}
                </div>
              )}
              {(hasResponsibilities || rawJD.length > 400) && (
                <button onClick={() => setShowFullJD(!showFullJD)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 12, fontWeight: 500, color: "#7c3aed", cursor: "pointer", background: "none", border: "none", padding: 0, fontFamily: "inherit" }}
                >
                  {showFullJD ? "Show less" : "Show all"} <ChevronDown size={12} style={showFullJD ? { transform: "rotate(180deg)" } : {}} />
                </button>
              )}
            </div>

            {/* Right: Company desc */}
            {companyDesc && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>About {submission.companyName}</div>
                <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.65, margin: 0 }}>{companyDesc.slice(0, 500)}{companyDesc.length > 500 ? "..." : ""}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Notes panel */}
      {showNotes && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 20, animation: "fadeUp 0.2s ease" }}>
          <textarea
            placeholder="Add notes about this application..."
            value={notesValue}
            onChange={e => { setNotesValue(e.target.value); setNotesDirty(true); }}
            style={{ width: "100%", minHeight: 80, padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontFamily: "inherit", color: "#374151", resize: "vertical", outline: "none", lineHeight: 1.5, boxSizing: "border-box" }}
            onFocus={e => { e.target.style.borderColor = "#c4b5fd"; }}
            onBlur={e => { e.target.style.borderColor = "#e5e7eb"; }}
          />
          {notesDirty && (
            <button onClick={() => notesMutation.mutate(notesValue)} disabled={notesMutation.isPending}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "#111827", color: "#fff", marginTop: 8 }}
            >
              <Save size={12} /> {notesMutation.isPending ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          SECTION 3: FULL-WIDTH CONTACTS
         ════════════════════════════════════════════ */}

      {/* Header + filter tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
          People
          <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 14, marginLeft: 8 }}>{filteredContacts.length}</span>
        </h2>
        <div style={{ display: "flex", gap: 2, background: "#f3f4f6", borderRadius: 8, padding: 2 }}>
          {[
            { key: "all", label: "All" },
            { key: "recruiter", label: "Recruiters" },
            { key: "hiring-manager", label: "Hiring Mgrs" },
          ].map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: activeFilter === f.key ? 600 : 500,
                fontFamily: "inherit", border: "none", cursor: "pointer",
                background: activeFilter === f.key ? "#fff" : "transparent",
                color: activeFilter === f.key ? "#111827" : "#6b7280",
                boxShadow: activeFilter === f.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.12s ease",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact table */}
      {filteredContacts.length === 0 ? (
        <div style={{ background: "#f9fafb", borderRadius: 12, padding: "48px 20px", textAlign: "center" }}>
          <Users size={24} style={{ color: "#d1d5db", marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>No contacts found</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 120px 100px 90px", gap: 0, padding: "10px 20px", borderBottom: "1px solid #f0f0f3", background: "#fafafe" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Type</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Match</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</span>
          </div>

          {filteredContacts.map((contact, idx) => {
            const vs = contact.verificationStatus || "unknown";
            const cfg = emailStatusConfig[vs] || emailStatusConfig.unknown;
            const StatusIcon = cfg.icon;
            const matchInfo = getMatchInfo(contact);
            const hasMessages = contact.emailDraft || contact.linkedinMessage;
            const isGenerating = generatingMessageFor === contact.id;
            const isContacted = contact.contactStatus && contact.contactStatus !== "not_contacted";
            const isExpanded = expandedContact === contact.id;
            const isLast = idx === filteredContacts.length - 1;
            const bucketLabel = contact.outreachBucket === "department_lead" ? "Hiring Mgr" : "Recruiter";

            return (
              <div key={contact.id} style={{ animation: "fadeUp 0.3s ease both", animationDelay: `${idx * 30}ms` }}>
                {/* Row */}
                <div
                  className="jd-expand-row"
                  onClick={() => setExpandedContact(isExpanded ? null : contact.id)}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 180px 120px 100px 90px", gap: 0,
                    padding: "14px 20px", alignItems: "center",
                    borderBottom: (isLast && !isExpanded) ? "none" : "1px solid #f3f4f6",
                  }}
                >
                  {/* Contact */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 18, flexShrink: 0,
                      background: contact.outreachBucket === "department_lead"
                        ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                        : "linear-gradient(135deg, #a78bfa, #7c3aed)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "#fff",
                    }}>
                      {getInitials(contact.name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
                        {contact.name || "Unknown"}
                        {contact.linkedinUrl && (
                          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                            <Linkedin size={13} style={{ color: "#0a66c2", opacity: 0.6 }} />
                          </a>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {contact.title || "No title"}
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                    {contact.email ? (
                      <>
                        <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "'SF Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {contact.email}
                        </span>
                        <StatusIcon size={12} style={{ color: cfg.color, flexShrink: 0 }} />
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: "#d1d5db" }}>--</span>
                    )}
                  </div>

                  {/* Type */}
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5, width: "fit-content",
                    background: contact.outreachBucket === "department_lead" ? "#ecfeff" : "#f5f3ff",
                    color: contact.outreachBucket === "department_lead" ? "#0891b2" : "#7c3aed",
                  }}>
                    {bucketLabel}
                  </span>

                  {/* Match */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: matchInfo.dotColor }} />
                    <span style={{ fontSize: 12, color: matchInfo.color, fontWeight: 500 }}>{matchInfo.label}</span>
                  </div>

                  {/* Status */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {isContacted ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#059669" }}>Sent</span>
                    ) : hasMessages ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed" }}>Drafted</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#d1d5db" }}>--</span>
                    )}
                    <ChevronRight size={13} style={{ color: "#d1d5db", marginLeft: "auto", transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "none" }} />
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div style={{
                    padding: "16px 20px 20px 68px", borderBottom: isLast ? "none" : "1px solid #f3f4f6",
                    background: "#fafafe", animation: "fadeUp 0.15s ease",
                  }}>
                    {/* Info chips */}
                    <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 12, color: "#6b7280" }}>
                      {formatSeniority(contact.seniority) && (
                        <span><span style={{ color: "#9ca3af" }}>Seniority:</span> {formatSeniority(contact.seniority)}</span>
                      )}
                      {contact.department && (
                        <span><span style={{ color: "#9ca3af" }}>Dept:</span> {contact.department}</span>
                      )}
                      {contact.email && (
                        <span><span style={{ color: "#9ca3af" }}>Email:</span> <span style={{ color: cfg.color }}>{cfg.text}</span></span>
                      )}
                    </div>

                    {/* Email copy row */}
                    {contact.email && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                          <Mail size={13} style={{ color: "#9ca3af" }} />
                          <span style={{ fontSize: 13, color: "#374151", fontFamily: "'SF Mono', monospace" }}>{contact.email}</span>
                        </div>
                        <button onClick={e => { e.stopPropagation(); copyToClipboard(contact.email!, `email-${contact.id}`); }}
                          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: "inherit", fontWeight: 500, color: "#6b7280" }}
                        >
                          {copiedId === `email-${contact.id}` ? <><Check size={12} style={{ color: "#059669" }} /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {!hasMessages ? (
                        <button disabled={isGenerating} onClick={e => { e.stopPropagation(); generateMessageMutation.mutate(contact.id); }}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px",
                            borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                            cursor: isGenerating ? "default" : "pointer", border: "none",
                            background: "#111827", color: "#fff", opacity: isGenerating ? 0.7 : 1,
                          }}
                        >
                          {isGenerating ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Drafting...</> : <><Sparkles size={13} /> Draft Messages</>}
                        </button>
                      ) : (
                        <>
                          <button onClick={e => { e.stopPropagation(); setSelectedContact(contact.id); }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151" }}
                          >
                            <Eye size={13} /> View Messages
                          </button>
                          <button onClick={e => { e.stopPropagation(); copyToClipboard(contact.emailDraft || "", `draft-${contact.id}`); }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151" }}
                          >
                            {copiedId === `draft-${contact.id}` ? <><Check size={13} style={{ color: "#059669" }} /> Copied</> : <><Copy size={13} /> Copy Email</>}
                          </button>
                        </>
                      )}
                      {contact.linkedinUrl && (
                        <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #dbeafe", background: "#fff", color: "#2563eb", textDecoration: "none" }}
                        >
                          <Linkedin size={13} /> LinkedIn
                        </a>
                      )}
                      <button onClick={e => { e.stopPropagation(); onNavigate("contact-detail", { contactId: contact.id }); }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", border: "none", background: "transparent", color: "#7c3aed", marginLeft: "auto" }}
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

      {/* Activity footer */}
      {contactedContacts.length > 0 && (
        <div style={{ marginTop: 20, padding: 16, background: "#f9fafb", borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Recent Activity</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {contactedContacts.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
                <Check size={12} style={{ color: "#059669" }} />
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span style={{ color: "#9ca3af" }}>{c.lastContactedAt ? timeAgo(c.lastContactedAt) : "sent"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ LOG OUTREACH MODAL ═══ */}
      {logModalOpen && (
        <div onClick={() => setLogModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, marginTop: 0 }}>Log Outreach</h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Select contact to mark as emailed</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {notContactedContacts.map(c => (
                <div key={c.id} onClick={() => setLogSelectedContact(c.id)}
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
                    color: logSelectedContact === c.id ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 700,
                  }}>{getInitials(c.name)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{c.name || "Unknown"}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.title || ""}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setLogModalOpen(false)}
                style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151" }}
              >Cancel</button>
              <button disabled={!logSelectedContact || logOutreachMutation.isPending}
                onClick={() => logSelectedContact && logOutreachMutation.mutate(logSelectedContact)}
                style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "#111827", color: "#fff", opacity: !logSelectedContact ? 0.4 : 1 }}
              >{logOutreachMutation.isPending ? "Saving..." : "Mark Sent"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MESSAGE PREVIEW MODAL ═══ */}
      {selectedContact && selectedContactData && (
        <div onClick={() => setSelectedContact(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #f3f4f6" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>{selectedContactData.name}</h3>
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2, marginBottom: 0 }}>{selectedContactData.title}</p>
              </div>
              <button onClick={() => setSelectedContact(null)} style={{ background: "#f3f4f6", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex" }}>
                <X size={16} style={{ color: "#6b7280" }} />
              </button>
            </div>

            <div style={{ overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              {selectedContactData.emailDraft && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <Mail size={13} style={{ color: "#7c3aed" }} /> Email Draft
                    </div>
                    <button onClick={() => copyToClipboard(selectedContactData.emailDraft || "", `modal-email-${selectedContactData.id}`)}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <Linkedin size={13} style={{ color: "#0a66c2" }} /> LinkedIn Message
                    </div>
                    <button onClick={() => copyToClipboard(selectedContactData.linkedinMessage || "", `modal-li-${selectedContactData.id}`)}
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
                  <button disabled={generatingMessageFor === selectedContactData.id}
                    onClick={() => generateMessageMutation.mutate(selectedContactData.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "none", background: "#111827", color: "#fff" }}
                  >
                    {generatingMessageFor === selectedContactData.id ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <><Sparkles size={13} /> Generate Messages</>}
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #f3f4f6" }}>
              <button onClick={() => setSelectedContact(null)}
                style={{ width: "100%", padding: 11, borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#374151" }}
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
