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
  ExternalLink,
  Sparkles,
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
  Wand2,
  RotateCcw,
  Shield,
  Star,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";

// ─── Interfaces ──────────────────────────────────────────────

interface Recruiter {
  id: number;
  name: string | null;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  verificationStatus: string;
  emailDraft: string | null;
  emailSubject: string | null;
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

// ─── Helpers ─────────────────────────────────────────────────

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

function getMatchInfo(contact: Recruiter): { label: string; color: string; bgColor: string } {
  if (contact.outreachBucket === "department_lead") {
    if (contact.seniority && /director|vp|head|c_suite|chief/i.test(contact.seniority)) {
      return { label: "Top Match", color: "#059669", bgColor: "#ecfdf5" };
    }
    return { label: "Strong", color: "#0891b2", bgColor: "#ecfeff" };
  }
  if (contact.seniority && /senior|lead|head/i.test(contact.seniority)) {
    return { label: "Strong", color: "#7c3aed", bgColor: "#f5f3ff" };
  }
  return { label: "Match", color: "#6b7280", bgColor: "#f9fafb" };
}

// ─── Component ───────────────────────────────────────────────

export function JobDetails({ submissionId, onNavigate }: JobDetailsProps) {
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
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
  const [editingDrafts, setEditingDrafts] = useState<Record<number, { email?: string; subject?: string }>>({});
  const [refineInput, setRefineInput] = useState<Record<number, string>>({});
  const [refiningFor, setRefiningFor] = useState<number | null>(null);
  const [savingDraftFor, setSavingDraftFor] = useState<number | null>(null);

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

  // ─── Mutations ──────────────

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!submissionId) return;
      await apiRequest("PATCH", `/api/submissions/${submissionId}`, { status: newStatus });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] }); },
  });

  const notesMutation = useMutation({
    mutationFn: async (notes: string) => {
      if (!submissionId) return;
      await apiRequest("PATCH", `/api/submissions/${submissionId}`, { notes });
    },
    onSuccess: () => { setNotesDirty(false); queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] }); },
  });

  const logOutreachMutation = useMutation({
    mutationFn: async (contactId: number) => {
      await apiRequest("PATCH", `/api/contacts/${contactId}`, {
        contactStatus: "email_sent",
        lastContactedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] }); setLogModalOpen(false); setLogSelectedContact(null); },
  });

  const generateMessageMutation = useMutation({
    mutationFn: async (contactId: number) => {
      setGeneratingMessageFor(contactId);
      await apiRequest("POST", `/api/contacts/${contactId}/generate-message`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] });
      setGeneratingMessageFor(null);
      setEditingDrafts(prev => { const next = { ...prev }; delete next[generatingMessageFor!]; return next; });
    },
    onError: () => { setGeneratingMessageFor(null); },
  });

  const refineMutation = useMutation({
    mutationFn: async ({ contactId, instructions, contact }: { contactId: number; instructions: string; contact: Recruiter }) => {
      setRefiningFor(contactId);
      const currentEmail = editingDrafts[contactId]?.email ?? contact.emailDraft;
      const currentSubject = editingDrafts[contactId]?.subject ?? contact.emailSubject;
      return apiRequest("POST", `/api/contacts/${contactId}/generate-message`, {
        instructions, currentDraft: currentEmail, currentSubject,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] });
      setRefiningFor(null);
      if (refiningFor) {
        setRefineInput(prev => ({ ...prev, [refiningFor]: "" }));
        setEditingDrafts(prev => { const next = { ...prev }; delete next[refiningFor]; return next; });
      }
    },
    onError: () => { setRefiningFor(null); },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async ({ contactId, subject, body }: { contactId: number; subject: string; body: string }) => {
      setSavingDraftFor(contactId);
      await apiRequest("PATCH", `/api/contacts/${contactId}`, { emailDraft: body, emailSubject: subject });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] });
      setSavingDraftFor(null);
      if (savingDraftFor) { setEditingDrafts(prev => { const next = { ...prev }; delete next[savingDraftFor]; return next; }); }
    },
    onError: () => { setSavingDraftFor(null); },
  });

  // ─── Helpers ──────────────

  const emailStatusConfig: Record<string, { icon: typeof CheckCircle; text: string; color: string; bg: string }> = {
    valid: { icon: CheckCircle, text: "Verified", color: "#059669", bg: "#ecfdf5" },
    risky: { icon: AlertTriangle, text: "Risky", color: "#d97706", bg: "#fffbeb" },
    invalid: { icon: XCircle, text: "Invalid", color: "#ef4444", bg: "#fef2f2" },
    unknown: { icon: HelpCircle, text: "Unverified", color: "#9ca3af", bg: "#f9fafb" },
  };

  const copyToClipboard = (text: string, id?: string) => {
    const doCopy = () => { if (id) { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } };
    if (navigator.clipboard?.writeText) {
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

  const handleStatusChange = (newStatus: string) => { statusMutation.mutate(newStatus); setOpenStatusDropdown(false); };

  // ─── Loading / Error states ──────────────

  if (!submissionId) {
    return (
      <div className="max-w-[960px] mx-auto px-6 py-8">
        <button onClick={() => onNavigate("job-history")} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Job History
        </button>
        <div className="bg-[#F8FAFC] rounded-2xl p-12 text-center text-[#94A3B8]">No submission selected.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-[960px] mx-auto px-6 py-8">
        <div className="text-center py-20">
          <div className="w-12 h-12 bg-[#F5F3FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-6 h-6 text-[#7C3AED] animate-spin" />
          </div>
          <p className="text-[#94A3B8] text-sm">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="max-w-[960px] mx-auto px-6 py-8">
        <button onClick={() => onNavigate("job-history")} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Job History
        </button>
        <div className="bg-[#FEF2F2] rounded-2xl p-12 text-center text-[#EF4444]">Failed to load submission details</div>
      </div>
    );
  }

  // ─── Data prep ──────────────

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
  }).sort((a, b) => {
    const aScore = (a.contactStatus && a.contactStatus !== "not_contacted" ? 2 : 0) + ((a.emailDraft || a.linkedinMessage) ? 1 : 0);
    const bScore = (b.contactStatus && b.contactStatus !== "not_contacted" ? 2 : 0) + ((b.emailDraft || b.linkedinMessage) ? 1 : 0);
    return bScore - aScore;
  });

  const validContacts = allContacts.filter(c => c.verificationStatus === "valid").length;
  const recruiters = allContacts.filter(c => c.outreachBucket === "recruiter").length;
  const hiringManagers = allContacts.filter(c => c.outreachBucket === "department_lead").length;

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
    { display: "Closed", value: "closed", dot: "#64748b" },
  ];
  const normalizedStatus = LEGACY_STATUS_MAP[submission.status] || (statusOptions.some(s => s.value === submission.status) ? submission.status : "saved");
  const currentStatusOpt = statusOptions.find(s => s.value === normalizedStatus) || statusOptions[0];

  const companyWebsite = submission.companyDomain ? `https://${submission.companyDomain.replace(/^https?:\/\//, "")}` : null;
  const rawJD = submission.jobInput || "";
  const hasResponsibilities = parsed.responsibilities.length > 0;

  // ─── Render ──────────────

  return (
    <div className="max-w-[960px] mx-auto px-6 pt-6 pb-20">

      {/* ── Back button ── */}
      <button
        onClick={() => onNavigate("job-history")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Job History
      </button>

      {/* ═══════════════════════════════════════════
          SECTION 1: JOB HEADER CARD
         ═══════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 md:p-8 mb-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl md:text-[28px] font-extrabold text-[#0F172A] leading-tight tracking-tight flex-1">
            {submission.jobTitle || "Untitled Position"}
          </h1>

          {/* Status dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#E2E8F0] bg-white text-[#374151] hover:bg-[#FAFBFC] transition-colors"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: currentStatusOpt.dot }} />
              {statusMutation.isPending ? "..." : currentStatusOpt.display}
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </button>
            {openStatusDropdown && (
              <>
                <div onClick={() => setOpenStatusDropdown(false)} className="fixed inset-0 z-[19]" />
                <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-xl shadow-black/10 border border-[#E2E8F0] z-20 min-w-[180px] py-1.5">
                  {statusOptions.map(s => (
                    <button key={s.value} onClick={() => handleStatusChange(s.value)}
                      className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm transition-colors ${
                        normalizedStatus === s.value ? 'bg-[#F5F3FF] text-[#7C3AED] font-semibold' : 'text-[#374151] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
                      {s.display}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Metadata pills */}
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F172A]">
            <Building2 className="w-4 h-4 text-[#7C3AED]" />
            {submission.companyName || "Unknown"}
          </span>
          {parsed.location && (
            <span className="inline-flex items-center gap-1 text-sm text-[#64748B]">
              <MapPin className="w-3.5 h-3.5" /> {parsed.location}
            </span>
          )}
          {parsed.department && (
            <span className="inline-flex items-center gap-1 text-sm text-[#64748B]">
              <Briefcase className="w-3.5 h-3.5" /> {parsed.department}
            </span>
          )}
          {companyWebsite && (
            <a href={companyWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#7C3AED] hover:text-[#6D28D9] font-medium transition-colors">
              <Globe className="w-3.5 h-3.5" /> {submission.companyDomain}
            </a>
          )}
          <span className="inline-flex items-center gap-1 text-sm text-[#94A3B8]">
            <Calendar className="w-3.5 h-3.5" /> {formatDate(submission.submittedAt)}
          </span>
        </div>

        {/* Stats badges */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: `${allContacts.length} Contact${allContacts.length !== 1 ? 's' : ''}`, icon: Users },
            { label: `${validContacts} Verified`, icon: Shield },
            { label: `${recruiters} Recruiter${recruiters !== 1 ? 's' : ''}`, icon: null },
            { label: `${hiringManagers} Hiring Mgr${hiringManagers !== 1 ? 's' : ''}`, icon: null },
            ...(contactedContacts.length > 0 ? [{ label: `${contactedContacts.length} Reached Out`, icon: Send }] : []),
          ].map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] bg-[#F1F5F9] px-3 py-1.5 rounded-lg">
              {s.icon && <s.icon className="w-3 h-3 text-[#94A3B8]" />}
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 2: ACTION TOOLBAR
         ═══════════════════════════════════════════ */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setShowJobInfo(!showJobInfo)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
            showJobInfo
              ? 'bg-[#F5F3FF] border-[#DDD6FE] text-[#7C3AED]'
              : 'bg-white border-[#E2E8F0] text-[#374151] hover:bg-[#FAFBFC]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Job Details
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showJobInfo ? 'rotate-180' : ''}`} />
        </button>

        <button
          onClick={() => setShowNotes(!showNotes)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
            showNotes
              ? 'bg-[#F5F3FF] border-[#DDD6FE] text-[#7C3AED]'
              : 'bg-white border-[#E2E8F0] text-[#374151] hover:bg-[#FAFBFC]'
          }`}
        >
          <FileText className="w-4 h-4" />
          Notes
          {submission.notes && <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
        </button>

        {notContactedContacts.length > 0 && (
          <button
            onClick={() => setLogModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E2E8F0] bg-white text-[#374151] hover:bg-[#FAFBFC] transition-all"
          >
            <Send className="w-4 h-4" />
            Log Outreach
          </button>
        )}
      </div>

      {/* Collapsible Job Details panel */}
      {showJobInfo && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className={`grid gap-6 ${companyDesc ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            <div className="text-sm text-[#4B5563] leading-relaxed">
              {parsed.summary && (
                <p className="text-[#374151] text-[15px] mb-4 leading-relaxed">{parsed.summary}</p>
              )}
              {hasResponsibilities && (
                <div className="mb-4">
                  <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Responsibilities</div>
                  <ul className="space-y-1.5 pl-4 list-disc marker:text-[#D1D5DB]">
                    {parsed.responsibilities.slice(0, showFullJD ? undefined : 4).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {parsed.requirements.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Requirements</div>
                  <ul className="space-y-1.5 pl-4 list-disc marker:text-[#D1D5DB]">
                    {parsed.requirements.slice(0, showFullJD ? undefined : 4).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {!hasResponsibilities && !parsed.summary && (
                <div className="whitespace-pre-wrap">{showFullJD ? rawJD : (rawJD.length > 400 ? rawJD.slice(0, 400) + "..." : rawJD)}</div>
              )}
              {(hasResponsibilities || rawJD.length > 400) && (
                <button onClick={() => setShowFullJD(!showFullJD)}
                  className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
                >
                  {showFullJD ? "Show less" : "Show all"}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showFullJD ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            {companyDesc && (
              <div>
                <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">About {submission.companyName}</div>
                <p className="text-sm text-[#4B5563] leading-relaxed">{companyDesc.slice(0, 500)}{companyDesc.length > 500 ? "..." : ""}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Notes panel */}
      {showNotes && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
          <textarea
            placeholder="Add notes about this application..."
            value={notesValue}
            onChange={e => { setNotesValue(e.target.value); setNotesDirty(true); }}
            className="w-full min-h-[80px] p-3 border border-[#E2E8F0] rounded-xl text-sm text-[#374151] resize-vertical outline-none leading-relaxed focus:border-[#C4B5FD] focus:ring-2 focus:ring-[#C4B5FD]/20 transition-all"
          />
          {notesDirty && (
            <button onClick={() => notesMutation.mutate(notesValue)} disabled={notesMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0F172A] text-white mt-3 hover:bg-[#1E293B] transition-colors disabled:opacity-50"
            >
              <Save className="w-3 h-3" /> {notesMutation.isPending ? "Saving..." : "Save Notes"}
            </button>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          SECTION 3: CONTACTS TABLE
         ═══════════════════════════════════════════ */}

      {/* Header + Filters */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#0F172A]">
          People
          <span className="font-normal text-[#94A3B8] text-base ml-2">{filteredContacts.length}</span>
        </h2>
        <div className="flex gap-0.5 bg-[#F1F5F9] rounded-xl p-1">
          {[
            { key: "all", label: "All" },
            { key: "recruiter", label: "Recruiters" },
            { key: "hiring-manager", label: "Hiring Mgrs" },
          ].map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === f.key
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact list */}
      {filteredContacts.length === 0 ? (
        <div className="bg-[#F8FAFC] rounded-2xl p-12 text-center">
          <Users className="w-8 h-8 text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-sm text-[#94A3B8]">No contacts found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_180px_110px_100px_80px] gap-0 px-5 py-3 bg-[#FAFBFC] border-b border-[#E2E8F0]">
            {["Contact", "Email", "Type", "Match", "Status"].map(h => (
              <span key={h} className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">{h}</span>
            ))}
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
              <div key={contact.id}>
                {/* Row */}
                <div
                  onClick={() => setExpandedContact(isExpanded ? null : contact.id)}
                  className={`grid grid-cols-1 md:grid-cols-[1fr_180px_110px_100px_80px] gap-3 md:gap-0 px-5 py-4 items-center cursor-pointer transition-colors hover:bg-[#FAFBFC] ${
                    !isLast || isExpanded ? 'border-b border-[#F1F5F9]' : ''
                  } ${isExpanded ? 'bg-[#FAFBFC]' : ''}`}
                >
                  {/* Contact info */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        background: contact.outreachBucket === "department_lead"
                          ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                          : "linear-gradient(135deg, #a78bfa, #7c3aed)",
                      }}
                    >
                      {getInitials(contact.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#0F172A] flex items-center gap-1.5">
                        <span className="truncate">{contact.name || "Unknown"}</span>
                        {contact.linkedinUrl && (
                          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex-shrink-0">
                            <Linkedin className="w-3.5 h-3.5 text-[#0A66C2] opacity-60 hover:opacity-100 transition-opacity" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-[#94A3B8] truncate">{contact.title || "No title"}</div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {contact.email ? (
                      <>
                        <span className="text-xs text-[#64748B] font-mono truncate">{contact.email}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0`}
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}
                        >
                          <StatusIcon className="w-2.5 h-2.5" />
                          {cfg.text}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-[#D1D5DB]">No email</span>
                    )}
                  </div>

                  {/* Type */}
                  <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-md w-fit ${
                    contact.outreachBucket === "department_lead"
                      ? 'bg-[#ECFEFF] text-[#0891B2]'
                      : 'bg-[#F5F3FF] text-[#7C3AED]'
                  }`}>
                    {bucketLabel}
                  </span>

                  {/* Match */}
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md w-fit"
                    style={{ backgroundColor: matchInfo.bgColor, color: matchInfo.color }}
                  >
                    {matchInfo.label === "Top Match" && <Star className="w-3 h-3" />}
                    {matchInfo.label}
                  </span>

                  {/* Status */}
                  <div className="flex items-center gap-1.5">
                    {isContacted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <Check className="w-3 h-3" /> Sent
                      </span>
                    ) : hasMessages ? (
                      <span className="text-[11px] font-bold text-[#7C3AED]">Drafted</span>
                    ) : (
                      <span className="text-[11px] text-[#D1D5DB]">—</span>
                    )}
                    <ChevronRight className={`w-3.5 h-3.5 text-[#D1D5DB] ml-auto transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* ── Expanded Panel ── */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 md:pl-[68px] border-b border-[#E2E8F0] bg-[#FAFBFC] animate-in fade-in slide-in-from-top-1 duration-150">

                    {/* Contact meta */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 text-xs text-[#64748B]">
                      {formatSeniority(contact.seniority) && (
                        <span><span className="text-[#94A3B8]">Seniority:</span> {formatSeniority(contact.seniority)}</span>
                      )}
                      {contact.department && (
                        <span><span className="text-[#94A3B8]">Dept:</span> {contact.department}</span>
                      )}
                      {contact.email && (
                        <span><span className="text-[#94A3B8]">Email:</span> <span style={{ color: cfg.color }} className="font-medium">{cfg.text}</span></span>
                      )}
                      {contact.linkedinUrl && (
                        <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[#2563EB] font-medium hover:underline"
                        >
                          <Linkedin className="w-3 h-3" /> LinkedIn
                        </a>
                      )}
                    </div>

                    {/* Email copy row */}
                    {contact.email && (
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-white rounded-lg border border-[#E2E8F0]">
                          <Mail className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0" />
                          <span className="text-sm text-[#374151] font-mono truncate">{contact.email}</span>
                        </div>
                        <button onClick={e => { e.stopPropagation(); copyToClipboard(contact.email!, `email-${contact.id}`); }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                        >
                          {copiedId === `email-${contact.id}` ? <><Check className="w-3 h-3 text-emerald-600" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                        </button>
                      </div>
                    )}

                    {/* ── Email Workspace ── */}
                    {(() => {
                      const isBusy = isGenerating || refiningFor === contact.id;
                      const localSubject = editingDrafts[contact.id]?.subject;
                      const localBody = editingDrafts[contact.id]?.email;
                      const currentSubject = localSubject ?? contact.emailSubject ?? "";
                      const currentBody = localBody ?? contact.emailDraft ?? "";
                      const hasLocalEdits = localSubject !== undefined || localBody !== undefined;

                      return !hasMessages ? (
                        <button disabled={isGenerating} onClick={e => { e.stopPropagation(); generateMessageMutation.mutate(contact.id); }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0F172A] text-white hover:bg-[#1E293B] transition-colors disabled:opacity-60"
                        >
                          {isGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><Sparkles className="w-3.5 h-3.5" /> Generate Email &amp; LinkedIn</>}
                        </button>
                      ) : (
                        <div className="space-y-3">
                          {/* Email card */}
                          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                            {/* Toolbar */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F1F5F9] bg-[#FAFBFC]">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7C3AED] uppercase tracking-wider">
                                <Mail className="w-3 h-3" /> Email Draft
                              </div>
                              <div className="flex gap-1.5">
                                {hasLocalEdits && (
                                  <button onClick={e => { e.stopPropagation(); setEditingDrafts(prev => { const next = { ...prev }; delete next[contact.id]; return next; }); }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] font-medium transition-colors"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" /> Revert
                                  </button>
                                )}
                                {hasLocalEdits && (
                                  <button onClick={e => { e.stopPropagation(); saveDraftMutation.mutate({ contactId: contact.id, subject: currentSubject, body: currentBody }); }}
                                    disabled={savingDraftFor === contact.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-[#0F172A] text-white font-semibold hover:bg-[#1E293B] transition-colors disabled:opacity-50"
                                  >
                                    {savingDraftFor === contact.id ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving...</> : <><Save className="w-2.5 h-2.5" /> Save</>}
                                  </button>
                                )}
                                <button onClick={e => { e.stopPropagation(); copyToClipboard(currentSubject ? `Subject: ${currentSubject}\n\n${currentBody}` : currentBody, `draft-email-${contact.id}`); }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] font-medium transition-colors"
                                >
                                  {copiedId === `draft-email-${contact.id}` ? <><Check className="w-2.5 h-2.5 text-emerald-600" /> Copied</> : <><Copy className="w-2.5 h-2.5" /> Copy</>}
                                </button>
                                <button onClick={e => { e.stopPropagation(); generateMessageMutation.mutate(contact.id); }}
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] font-medium transition-colors disabled:opacity-50"
                                >
                                  {isGenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />} Regen
                                </button>
                              </div>
                            </div>

                            {/* Subject */}
                            <div className="px-4 pt-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-[#94A3B8] flex-shrink-0">Subject:</span>
                                <input
                                  type="text"
                                  value={currentSubject}
                                  onChange={e => { e.stopPropagation(); setEditingDrafts(prev => ({ ...prev, [contact.id]: { ...prev[contact.id], subject: e.target.value } })); }}
                                  onClick={e => e.stopPropagation()}
                                  placeholder="Email subject line..."
                                  className="flex-1 py-1.5 border-none border-b border-[#F1F5F9] text-sm font-semibold text-[#0F172A] outline-none bg-transparent focus:border-[#C4B5FD] transition-colors"
                                />
                              </div>
                            </div>

                            {/* Body */}
                            <div className="px-4 pb-4 pt-2">
                              <textarea
                                value={currentBody}
                                onChange={e => { e.stopPropagation(); setEditingDrafts(prev => ({ ...prev, [contact.id]: { ...prev[contact.id], email: e.target.value } })); }}
                                onClick={e => e.stopPropagation()}
                                className="w-full min-h-[200px] p-0 border-none text-sm text-[#374151] resize-vertical outline-none leading-relaxed bg-transparent"
                              />
                            </div>
                          </div>

                          {/* AI Refine bar */}
                          <div className="bg-[#F5F3FF] border border-[#EDE9FE] rounded-xl p-3">
                            <div className="flex gap-2 items-center">
                              <Wand2 className="w-4 h-4 text-[#7C3AED] flex-shrink-0" />
                              <input
                                type="text"
                                value={refineInput[contact.id] || ""}
                                onChange={e => { e.stopPropagation(); setRefineInput(prev => ({ ...prev, [contact.id]: e.target.value })); }}
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && refineInput[contact.id]?.trim()) {
                                    e.stopPropagation();
                                    refineMutation.mutate({ contactId: contact.id, instructions: refineInput[contact.id], contact });
                                  }
                                }}
                                placeholder="Refine: make it shorter, more casual, mention my data experience..."
                                className="flex-1 px-3 py-2 border border-[#DDD6FE] rounded-lg text-xs text-[#374151] outline-none bg-white focus:border-[#A78BFA] focus:ring-1 focus:ring-[#A78BFA]/20 transition-all"
                              />
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (refineInput[contact.id]?.trim()) refineMutation.mutate({ contactId: contact.id, instructions: refineInput[contact.id], contact });
                                }}
                                disabled={!refineInput[contact.id]?.trim() || refiningFor === contact.id}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                              >
                                {refiningFor === contact.id ? <><Loader2 className="w-3 h-3 animate-spin" /> Refining...</> : "Refine"}
                              </button>
                            </div>
                            {/* Quick chips */}
                            <div className="flex gap-1.5 flex-wrap mt-2 pl-6">
                              {["Shorter", "More casual", "More formal", "Add urgency", "Softer ask"].map(chip => (
                                <button key={chip}
                                  onClick={e => { e.stopPropagation(); setRefineInput(prev => ({ ...prev, [contact.id]: chip.toLowerCase() })); }}
                                  className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-[#DDD6FE] bg-white text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors"
                                >
                                  {chip}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Activity footer */}
      {contactedContacts.length > 0 && (
        <div className="mt-5 p-5 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3">Recent Activity</div>
          <div className="flex gap-4 flex-wrap">
            {contactedContacts.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-[#374151]">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <span className="font-semibold">{c.name}</span>
                <span className="text-[#94A3B8]">{c.lastContactedAt ? timeAgo(c.lastContactedAt) : "sent"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ LOG OUTREACH MODAL ═══ */}
      {logModalOpen && (
        <div onClick={() => setLogModalOpen(false)} className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Log Outreach</h3>
                <p className="text-sm text-[#64748B] mt-0.5">Select contact to mark as emailed</p>
              </div>
              <button onClick={() => setLogModalOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {notContactedContacts.map(c => (
                <div key={c.id} onClick={() => setLogSelectedContact(c.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    logSelectedContact === c.id
                      ? 'border-[#7C3AED] bg-[#FAF5FF]'
                      : 'border-[#E2E8F0] hover:border-[#D1D5DB] bg-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                    logSelectedContact === c.id ? 'bg-[#7C3AED] text-white' : 'bg-[#F1F5F9] text-[#94A3B8]'
                  }`}>{getInitials(c.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#0F172A] truncate">{c.name || "Unknown"}</div>
                    <div className="text-xs text-[#94A3B8] truncate">{c.title || ""}</div>
                  </div>
                  {logSelectedContact === c.id && <Check className="w-4 h-4 text-[#7C3AED] flex-shrink-0" />}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setLogModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E2E8F0] bg-white text-[#374151] hover:bg-[#F8FAFC] transition-colors"
              >Cancel</button>
              <button
                disabled={!logSelectedContact || logOutreachMutation.isPending}
                onClick={() => logSelectedContact && logOutreachMutation.mutate(logSelectedContact)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#0F172A] text-white hover:bg-[#1E293B] transition-colors disabled:opacity-40"
              >{logOutreachMutation.isPending ? "Saving..." : "Mark as Sent"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
