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

const css = `
.jd-root {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  color: #1e1e2d;
  min-height: 100vh;
}

/* ── Header ── */
.jd-header {
  margin-bottom: 20px;
}
.jd-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #7c3aed;
  cursor: pointer;
  margin-bottom: 16px;
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
}
.jd-back:hover { text-decoration: underline; }

.jd-header-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.jd-header-left {
  flex: 1;
  min-width: 0;
}
.jd-header-title {
  font-size: 22px;
  font-weight: 700;
  color: #1e1e2d;
  line-height: 1.25;
  margin: 0;
}
.jd-header-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.jd-header-meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: #6b7280;
}
.jd-header-meta-item svg { color: #9ca3af; }
.jd-header-meta-item a { color: #7c3aed; text-decoration: none; }
.jd-header-meta-item a:hover { text-decoration: underline; }

.jd-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* ── Stats strip ── */
.jd-stats {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.jd-stat {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 10px;
  font-size: 13px;
  color: #4b5563;
}
.jd-stat-num {
  font-weight: 700;
  color: #1e1e2d;
  font-size: 15px;
}
.jd-stat-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ── Grid ── */
.jd-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 1023px) {
  .jd-grid { grid-template-columns: 1fr; }
}

/* ── Cards ── */
.jd-card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  overflow: hidden;
}
.jd-card-inner { padding: 20px; }

/* ── Contact cards ── */
.jd-contacts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.jd-contacts-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e1e2d;
}
.jd-filter-pills {
  display: flex;
  gap: 6px;
}
.jd-filter-pill {
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  border: none;
  cursor: pointer;
  transition: all 0.12s;
}

.jd-contact-card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 10px;
  transition: all 0.15s;
  cursor: pointer;
}
.jd-contact-card:hover {
  border-color: #d4d0e8;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.06);
}
.jd-contact-card:last-child { margin-bottom: 0; }

.jd-contact-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.jd-contact-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  color: #fff;
}
.jd-contact-info { flex: 1; min-width: 0; }
.jd-contact-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e1e2d;
  display: flex;
  align-items: center;
  gap: 8px;
}
.jd-contact-title-text {
  font-size: 12.5px;
  color: #6b7280;
  margin-top: 2px;
}
.jd-contact-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.jd-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.jd-contact-email-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 8px;
}
.jd-contact-email {
  font-size: 13px;
  color: #4b5563;
  font-family: 'SF Mono', 'Fira Code', monospace;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.jd-contact-email-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  flex-shrink: 0;
}

.jd-contact-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.jd-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #4b5563;
}
.jd-action-btn:hover { border-color: #d1d5db; background: #f9fafb; }
.jd-action-btn.primary {
  background: #7c3aed;
  color: #fff;
  border-color: #7c3aed;
}
.jd-action-btn.primary:hover { background: #6d28d9; }
.jd-action-btn.primary:disabled { opacity: 0.6; cursor: default; }
.jd-action-btn.linkedin {
  color: #0a66c2;
  border-color: #0a66c2;
}
.jd-action-btn.linkedin:hover { background: #f0f7ff; }

.jd-contact-status-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #9ca3af;
}

.jd-copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 4px;
}
.jd-copy-btn:hover { background: #ede9fe; }

/* ── Right column ── */
.jd-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 72px);
  overflow-y: auto;
}
@media (max-width: 1023px) {
  .jd-right { position: static; max-height: none; }
}

.jd-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  cursor: pointer;
  user-select: none;
}
.jd-section-header:hover { background: #fafbfc; }
.jd-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e1e2d;
  display: flex;
  align-items: center;
  gap: 8px;
}
.jd-section-toggle {
  color: #9ca3af;
  transition: transform 0.15s;
}
.jd-section-toggle.open { transform: rotate(90deg); }
.jd-section-body {
  padding: 0 20px 16px;
  font-size: 13px;
  color: #4b5563;
  line-height: 1.65;
}
.jd-section-body ul { padding-left: 18px; margin: 0; }
.jd-section-body li { margin-bottom: 6px; }

.jd-show-more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #7c3aed;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
}
.jd-show-more:hover { text-decoration: underline; }

/* ── Notes ── */
.jd-notes-area {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  color: #1e1e2d;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
  line-height: 1.5;
}
.jd-notes-area:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.06);
}
.jd-notes-area::placeholder { color: #adb5bd; }
.jd-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: #7c3aed;
  color: #fff;
  margin-top: 8px;
  transition: background 0.12s;
}
.jd-save-btn:hover { background: #6d28d9; }
.jd-save-btn:disabled { opacity: 0.5; cursor: default; }

/* ── Outreach log ── */
.jd-outreach-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #4b5563;
  padding: 8px 12px;
  background: #fafbfc;
  border-radius: 8px;
  margin-bottom: 6px;
}
.jd-outreach-item:last-child { margin-bottom: 0; }
.jd-outreach-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ede9fe;
  color: #7c3aed;
  flex-shrink: 0;
}
.jd-outreach-name { font-weight: 500; color: #1e1e2d; }
.jd-outreach-date { font-size: 11px; color: #9ca3af; margin-left: auto; }

/* ── Status dropdown ── */
.jd-status-wrap { position: relative; }
.jd-status-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  background: #fff;
  transition: all 0.12s;
}
.jd-status-btn:hover { border-color: #d1d5db; }
.jd-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.jd-status-dd {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  z-index: 20;
  min-width: 180px;
  padding: 4px;
}
.jd-status-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  color: #4b5563;
  text-align: left;
}
.jd-status-opt:hover { background: #f5f3ff; color: #7c3aed; }
.jd-status-opt.active { background: #f5f3ff; color: #7c3aed; font-weight: 600; }

/* ── Log modal ── */
.jd-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}
.jd-modal {
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 420px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.jd-modal-lg {
  max-width: 640px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  padding: 0;
}

/* ── Pull contacts ── */
.jd-pull-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid #7c3aed;
  background: #fff;
  color: #7c3aed;
  transition: all 0.12s;
}
.jd-pull-btn:hover { background: #f5f3ff; }

/* ── Empty state ── */
.jd-empty {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
}
.jd-empty-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  background: #f3f4f6;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}
`;

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

  const emailStatusConfig: Record<string, { icon: typeof CheckCircle; text: string; color: string }> = {
    valid: { icon: CheckCircle, text: "Verified", color: "#10b981" },
    risky: { icon: AlertTriangle, text: "Risky", color: "#f59e0b" },
    invalid: { icon: XCircle, text: "Invalid", color: "#ef4444" },
    unknown: { icon: HelpCircle, text: "Unverified", color: "#9ca3af" },
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
      <div className="jd-root">
        <style>{css}</style>
        <button className="jd-back" onClick={() => onNavigate("job-history")}>
          <ArrowLeft className="w-4 h-4" /> Back to Job History
        </button>
        <div className="jd-card"><div className="jd-card-inner" style={{ textAlign: "center", color: "#9ca3af" }}>No submission selected. Please choose a job from history.</div></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="jd-root">
        <style>{css}</style>
        <button className="jd-back" onClick={() => onNavigate("job-history")}>
          <ArrowLeft className="w-4 h-4" /> Back to Job History
        </button>
        <div style={{ textAlign: "center", padding: 48 }}>
          <Loader2 className="w-8 h-8 text-[#7c3aed] animate-spin" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="jd-root">
        <style>{css}</style>
        <button className="jd-back" onClick={() => onNavigate("job-history")}>
          <ArrowLeft className="w-4 h-4" /> Back to Job History
        </button>
        <div className="jd-card"><div className="jd-card-inner" style={{ textAlign: "center", color: "#ef4444" }}>Failed to load submission details</div></div>
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

  // Avatar colors based on bucket
  const avatarColors = {
    recruiter: { bg: "#ede9fe", text: "#7c3aed" },
    department_lead: { bg: "#ecfeff", text: "#0891b2" },
  };

  return (
    <div className="jd-root">
      <style>{css}</style>

      {/* ═══ HEADER ═══ */}
      <div className="jd-header">
        <button className="jd-back" onClick={() => onNavigate("job-history")}>
          <ArrowLeft className="w-4 h-4" /> Back to Job History
        </button>

        <div className="jd-header-main">
          <div className="jd-header-left">
            <h1 className="jd-header-title">{submission.jobTitle || "Untitled Position"}</h1>
            <div className="jd-header-meta">
              <div className="jd-header-meta-item">
                <Building2 size={14} />
                <span>{submission.companyName || "Unknown Company"}</span>
              </div>
              {parsed.location && (
                <div className="jd-header-meta-item">
                  <MapPin size={14} />
                  <span>{parsed.location}</span>
                </div>
              )}
              {parsed.department && (
                <div className="jd-header-meta-item">
                  <Briefcase size={14} />
                  <span>{parsed.department}</span>
                </div>
              )}
              {companyWebsite && (
                <div className="jd-header-meta-item">
                  <ExternalLink size={14} />
                  <a href={companyWebsite} target="_blank" rel="noopener noreferrer">
                    {submission.companyDomain}
                  </a>
                </div>
              )}
              <div className="jd-header-meta-item">
                <Calendar size={14} />
                <span>{formatDate(submission.submittedAt)}</span>
              </div>
            </div>
          </div>

          <div className="jd-header-right">
            <div className="jd-status-wrap">
              <button
                className="jd-status-btn"
                onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
                disabled={statusMutation.isPending}
                style={{ background: currentStatusOpt.bg, color: currentStatusOpt.color, borderColor: "transparent" }}
              >
                <span className="jd-status-dot" style={{ backgroundColor: currentStatusOpt.dot }} />
                {statusMutation.isPending ? "Updating..." : currentStatusOpt.display}
                <ChevronDown size={14} />
              </button>
              {openStatusDropdown && (
                <div className="jd-status-dd">
                  {statusOptions.map(s => (
                    <button
                      key={s.value}
                      className={`jd-status-opt ${normalizedStatus === s.value ? "active" : ""}`}
                      onClick={() => handleStatusChange(s.value)}
                    >
                      <span className="jd-status-dot" style={{ backgroundColor: s.dot }} />
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
      <div className="jd-stats">
        <div className="jd-stat">
          <div className="jd-stat-icon" style={{ background: "#f3f4f6" }}>
            <Users size={15} style={{ color: "#6b7280" }} />
          </div>
          <span className="jd-stat-num">{allContacts.length}</span>
          Contacts
        </div>
        <div className="jd-stat">
          <div className="jd-stat-icon" style={{ background: "#ecfdf5" }}>
            <CheckCircle size={15} style={{ color: "#10b981" }} />
          </div>
          <span className="jd-stat-num">{validContacts}</span>
          Verified
        </div>
        <div className="jd-stat">
          <div className="jd-stat-icon" style={{ background: "#ede9fe" }}>
            <Briefcase size={15} style={{ color: "#7c3aed" }} />
          </div>
          <span className="jd-stat-num">{recruiters}</span>
          Recruiters
        </div>
        <div className="jd-stat">
          <div className="jd-stat-icon" style={{ background: "#ecfeff" }}>
            <Users size={15} style={{ color: "#0891b2" }} />
          </div>
          <span className="jd-stat-num">{hiringManagers}</span>
          Hiring Mgrs
        </div>
        {contactedContacts.length > 0 && (
          <div className="jd-stat">
            <div className="jd-stat-icon" style={{ background: "#fffbeb" }}>
              <Mail size={15} style={{ color: "#d97706" }} />
            </div>
            <span className="jd-stat-num">{contactedContacts.length}</span>
            Contacted
          </div>
        )}
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div className="jd-grid">

        {/* ── LEFT: Contact Cards ── */}
        <div>
          <div className="jd-contacts-header">
            <span className="jd-contacts-title">Contacts</span>
            <div className="jd-filter-pills">
              {[
                { key: "all", label: "All" },
                { key: "recruiter", label: "Recruiters" },
                { key: "hiring-manager", label: "Hiring Mgrs" },
              ].map(f => (
                <button
                  key={f.key}
                  className="jd-filter-pill"
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    background: activeFilter === f.key ? "#7c3aed" : "#f3f4f6",
                    color: activeFilter === f.key ? "#fff" : "#6b7280",
                    fontWeight: activeFilter === f.key ? 600 : 400,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredContacts.length === 0 ? (
            <div className="jd-empty">
              <div className="jd-empty-icon"><Users size={22} /></div>
              <p style={{ fontSize: 13 }}>No contacts found</p>
            </div>
          ) : (
            filteredContacts.map(contact => {
              const vs = contact.verificationStatus || "unknown";
              const cfg = emailStatusConfig[vs] || emailStatusConfig.unknown;
              const StatusIcon = cfg.icon;
              const cType = contact.outreachBucket === "department_lead" ? "Hiring Mgr" : "Recruiter";
              const colors = avatarColors[contact.outreachBucket as keyof typeof avatarColors] || avatarColors.recruiter;
              const hasMessages = contact.emailDraft || contact.linkedinMessage;
              const isGenerating = generatingMessageFor === contact.id;
              const isContacted = contact.contactStatus && contact.contactStatus !== "not_contacted";

              return (
                <div
                  key={contact.id}
                  className="jd-contact-card"
                  onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                >
                  {/* Top row: avatar + name/title + badges */}
                  <div className="jd-contact-top">
                    <div className="jd-contact-avatar" style={{ background: colors.bg, color: colors.text }}>
                      {getInitials(contact.name)}
                    </div>
                    <div className="jd-contact-info">
                      <div className="jd-contact-name">
                        {contact.name || "Unknown"}
                        {contact.linkedinUrl && (
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title="View LinkedIn"
                          >
                            <Linkedin size={14} style={{ color: "#0a66c2" }} />
                          </a>
                        )}
                      </div>
                      <div className="jd-contact-title-text">{contact.title || "No title"}</div>
                    </div>
                    <div className="jd-contact-badges">
                      <span
                        className="jd-badge"
                        style={{
                          background: contact.outreachBucket === "recruiter" ? "#f5f3ff" : "#ecfeff",
                          color: contact.outreachBucket === "recruiter" ? "#7c3aed" : "#0891b2",
                        }}
                      >
                        {cType}
                      </span>
                    </div>
                  </div>

                  {/* Email row */}
                  <div className="jd-contact-email-row">
                    <Mail size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
                    <span className="jd-contact-email">{contact.email || "No email found"}</span>
                    <div className="jd-contact-email-status" style={{ color: cfg.color }}>
                      <StatusIcon size={13} />
                      <span>{cfg.text}</span>
                    </div>
                    {contact.email && (
                      <button
                        className="jd-copy-btn"
                        onClick={e => { e.stopPropagation(); copyToClipboard(contact.email!, `email-${contact.id}`); }}
                        title="Copy email"
                      >
                        {copiedId === `email-${contact.id}` ? (
                          <Check size={13} style={{ color: "#10b981" }} />
                        ) : (
                          <Copy size={13} style={{ color: "#9ca3af" }} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="jd-contact-actions">
                    {!hasMessages ? (
                      <button
                        className="jd-action-btn primary"
                        disabled={isGenerating}
                        onClick={e => { e.stopPropagation(); generateMessageMutation.mutate(contact.id); }}
                      >
                        {isGenerating ? (
                          <><Loader2 size={13} className="animate-spin" /> Generating...</>
                        ) : (
                          <><Sparkles size={13} /> Draft Messages</>
                        )}
                      </button>
                    ) : (
                      <>
                        <button
                          className="jd-action-btn"
                          onClick={e => { e.stopPropagation(); setSelectedContact(contact.id); }}
                        >
                          <Eye size={13} /> View Messages
                        </button>
                        <button
                          className="jd-action-btn"
                          onClick={e => {
                            e.stopPropagation();
                            copyToClipboard(contact.emailDraft || "", `draft-${contact.id}`);
                          }}
                        >
                          {copiedId === `draft-${contact.id}` ? (
                            <><Check size={13} /> Copied!</>
                          ) : (
                            <><Copy size={13} /> Copy Email</>
                          )}
                        </button>
                      </>
                    )}
                    {contact.linkedinUrl && (
                      <a
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="jd-action-btn linkedin"
                        onClick={e => e.stopPropagation()}
                      >
                        <Linkedin size={13} /> LinkedIn
                      </a>
                    )}
                    {isContacted && (
                      <span className="jd-contact-status-badge">
                        <Check size={12} style={{ color: "#10b981" }} />
                        {contact.lastContactedAt ? timeAgo(contact.lastContactedAt) : "Contacted"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Pull more contacts CTA */}
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button className="jd-pull-btn">
              <Plus size={15} /> Pull Additional Contacts
            </button>
          </div>
        </div>

        {/* ── RIGHT: Job Info + Notes + Outreach Log ── */}
        <div className="jd-right">

          {/* Notes */}
          <div className="jd-card">
            <div className="jd-card-inner">
              <div className="jd-section-title" style={{ marginBottom: 10 }}>
                <FileText size={15} />
                Notes
              </div>
              <textarea
                className="jd-notes-area"
                placeholder="Add notes about this application..."
                value={notesValue}
                onChange={e => { setNotesValue(e.target.value); setNotesDirty(true); }}
              />
              {notesDirty && (
                <button
                  className="jd-save-btn"
                  onClick={() => notesMutation.mutate(notesValue)}
                  disabled={notesMutation.isPending}
                >
                  <Save size={13} />
                  {notesMutation.isPending ? "Saving..." : "Save Notes"}
                </button>
              )}
            </div>
          </div>

          {/* Outreach Log */}
          <div className="jd-card">
            <div className="jd-card-inner">
              <div className="jd-section-title" style={{ marginBottom: 10 }}>
                <Mail size={15} />
                Outreach Log
              </div>
              {contactedContacts.length > 0 ? (
                contactedContacts.map(c => (
                  <div key={c.id} className="jd-outreach-item">
                    <div className="jd-outreach-icon"><Mail size={14} /></div>
                    <div>
                      <div className="jd-outreach-name">{c.name || "Unknown"}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.title || ""}</div>
                    </div>
                    <div className="jd-outreach-date">
                      {c.lastContactedAt ? timeAgo(c.lastContactedAt) : "Contacted"}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0" }}>No outreach logged yet</p>
              )}
              {notContactedContacts.length > 0 && (
                <button
                  className="jd-show-more"
                  style={{ marginTop: contactedContacts.length > 0 ? 10 : 4 }}
                  onClick={() => setLogModalOpen(true)}
                >
                  <Plus size={14} /> Log outreach
                </button>
              )}
            </div>
          </div>

          {/* Job Description */}
          <div className="jd-card">
            <div className="jd-section-header" onClick={() => setShowResponsibilities(!showResponsibilities)}>
              <div className="jd-section-title">
                <Briefcase size={15} />
                Job Details
              </div>
              <ChevronRight size={16} className={`jd-section-toggle ${showResponsibilities ? "open" : ""}`} />
            </div>

            {showResponsibilities && (
              <div className="jd-section-body">
                {parsed.summary && (
                  <p style={{ marginBottom: 12, color: "#4b5563" }}>{parsed.summary}</p>
                )}
                {hasResponsibilities && (
                  <>
                    <strong style={{ fontSize: 12, color: "#1e1e2d", textTransform: "uppercase", letterSpacing: "0.4px" }}>Key Responsibilities</strong>
                    <ul style={{ marginTop: 8 }}>
                      {parsed.responsibilities.slice(0, showFullJD ? undefined : 4).map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                )}
                {parsed.requirements.length > 0 && (
                  <>
                    <strong style={{ fontSize: 12, color: "#1e1e2d", textTransform: "uppercase", letterSpacing: "0.4px", display: "block", marginTop: 14 }}>Requirements</strong>
                    <ul style={{ marginTop: 8 }}>
                      {parsed.requirements.slice(0, showFullJD ? undefined : 4).map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                )}
                {!hasResponsibilities && !parsed.summary && (
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {showFullJD ? rawJD : (rawJD.length > 300 ? rawJD.slice(0, 300) + "..." : rawJD)}
                  </div>
                )}
                {(hasResponsibilities || rawJD.length > 300) && (
                  <button className="jd-show-more" onClick={() => setShowFullJD(!showFullJD)}>
                    {showFullJD ? "Show less" : "Show all"} <ChevronDown size={14} style={showFullJD ? { transform: "rotate(180deg)" } : {}} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* About Company */}
          {companyDesc && (
            <div className="jd-card">
              <div className="jd-section-header" onClick={() => setShowCompanyDesc(!showCompanyDesc)}>
                <div className="jd-section-title">
                  <Building2 size={15} />
                  About {submission.companyName || "Company"}
                </div>
                <ChevronRight size={16} className={`jd-section-toggle ${showCompanyDesc ? "open" : ""}`} />
              </div>
              {showCompanyDesc && (
                <div className="jd-section-body" style={{ whiteSpace: "pre-wrap" }}>
                  {companyDesc}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ LOG OUTREACH MODAL ═══ */}
      {logModalOpen && (
        <div className="jd-modal-overlay" onClick={() => setLogModalOpen(false)}>
          <div className="jd-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Log Outreach</h3>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Select a contact to mark as emailed:</p>
            {notContactedContacts.map(c => (
              <div
                key={c.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  border: `1px solid ${logSelectedContact === c.id ? "#7c3aed" : "#e5e7eb"}`,
                  borderRadius: 8, cursor: "pointer", marginBottom: 8,
                  background: logSelectedContact === c.id ? "#f5f3ff" : "#fff",
                  transition: "all 0.12s",
                }}
                onClick={() => setLogSelectedContact(c.id)}
              >
                <Mail size={15} style={{ color: "#9ca3af" }} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.title || ""}</div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setLogModalOpen(false)}
                style={{
                  flex: 1, padding: 8, borderRadius: 8, fontSize: 13, fontWeight: 600,
                  fontFamily: "inherit", cursor: "pointer", border: "1px solid #e5e7eb",
                  background: "#fff", color: "#4b5563",
                }}
              >
                Cancel
              </button>
              <button
                disabled={!logSelectedContact || logOutreachMutation.isPending}
                onClick={() => logSelectedContact && logOutreachMutation.mutate(logSelectedContact)}
                style={{
                  flex: 1, padding: 8, borderRadius: 8, fontSize: 13, fontWeight: 600,
                  fontFamily: "inherit", cursor: "pointer", border: "none",
                  background: "#7c3aed", color: "#fff",
                  opacity: !logSelectedContact ? 0.5 : 1,
                }}
              >
                {logOutreachMutation.isPending ? "Saving..." : "Mark as Emailed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MESSAGE PREVIEW MODAL ═══ */}
      {selectedContact && selectedContactData && (
        <div className="jd-modal-overlay" onClick={() => setSelectedContact(null)}>
          <div className="jd-modal jd-modal-lg" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f0f0f3" }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Messages for {selectedContactData.name}</h3>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{selectedContactData.title}</p>
              </div>
              <button onClick={() => setSelectedContact(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={18} style={{ color: "#9ca3af" }} />
              </button>
            </div>

            {/* Message content */}
            <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Email */}
              {selectedContactData.emailDraft && (
                <div style={{ border: "1px solid #e8eaed", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fafbfc", borderBottom: "1px solid #f0f0f3" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1e1e2d" }}>
                      <Mail size={14} /> Email Draft
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedContactData.emailDraft || "", `modal-email-${selectedContactData.id}`)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280", fontFamily: "inherit" }}
                    >
                      {copiedId === `modal-email-${selectedContactData.id}` ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                  <div style={{ padding: 16, fontSize: 13, color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {selectedContactData.emailDraft}
                  </div>
                </div>
              )}

              {/* LinkedIn */}
              {selectedContactData.linkedinMessage && (
                <div style={{ border: "1px solid #e8eaed", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fafbfc", borderBottom: "1px solid #f0f0f3" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1e1e2d" }}>
                      <Linkedin size={14} /> LinkedIn Message
                    </div>
                    <button
                      onClick={() => copyToClipboard(selectedContactData.linkedinMessage || "", `modal-li-${selectedContactData.id}`)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280", fontFamily: "inherit" }}
                    >
                      {copiedId === `modal-li-${selectedContactData.id}` ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                  <div style={{ padding: 16, fontSize: 13, color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {selectedContactData.linkedinMessage}
                  </div>
                </div>
              )}

              {/* No messages yet */}
              {!selectedContactData.emailDraft && !selectedContactData.linkedinMessage && (
                <div className="jd-empty">
                  <div className="jd-empty-icon"><Sparkles size={22} /></div>
                  <p style={{ fontSize: 13, marginBottom: 12 }}>No messages generated yet</p>
                  <button
                    className="jd-action-btn primary"
                    disabled={generatingMessageFor === selectedContactData.id}
                    onClick={() => generateMessageMutation.mutate(selectedContactData.id)}
                  >
                    {generatingMessageFor === selectedContactData.id ? (
                      <><Loader2 size={13} className="animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles size={13} /> Generate Messages</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f0f3" }}>
              <button
                onClick={() => setSelectedContact(null)}
                style={{
                  width: "100%", padding: 10, borderRadius: 8, fontSize: 13,
                  fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                  border: "none", background: "#7c3aed", color: "#fff",
                }}
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
