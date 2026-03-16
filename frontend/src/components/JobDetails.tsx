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
    `about ${companyName}`,
    "about the company",
    "about us",
    "company overview",
    "who we are",
    `what is ${companyName}`,
  ];
  const lower = jobInput.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      const start = idx;
      const section = jobInput.slice(start);
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

function splitTitle(fullTitle: string | null): { main: string; sub: string | null } {
  if (!fullTitle) return { main: "Untitled Position", sub: null };
  const separators = [" - ", " – ", " — ", " | ", ": "];
  for (const sep of separators) {
    const idx = fullTitle.indexOf(sep);
    if (idx > 0 && idx < fullTitle.length - sep.length) {
      return { main: fullTitle.slice(0, idx).trim(), sub: fullTitle.slice(idx + sep.length).trim() };
    }
  }
  return { main: fullTitle, sub: null };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "Unknown"; }
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
.jd-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #7c3aed;
  cursor: pointer;
  margin-bottom: 20px;
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
}
.jd-back:hover { text-decoration: underline; }

.jd-grid {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 1023px) {
  .jd-grid { grid-template-columns: 1fr; }
}

.jd-left { display: flex; flex-direction: column; gap: 16px; }

.jd-card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  overflow: hidden;
}
.jd-card-inner { padding: 20px; }

.jd-summary-title {
  font-size: 19px;
  font-weight: 700;
  color: #1e1e2d;
  line-height: 1.25;
  margin: 0;
}
.jd-summary-sub {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 2px;
}
.jd-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f0f0f3;
}
.jd-meta-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #4b5563;
}
.jd-meta-item svg { color: #9ca3af; flex-shrink: 0; }
.jd-meta-label { color: #9ca3af; }

.jd-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f0f0f3;
}
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
  left: 0;
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

.jd-submitted {
  font-size: 12px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 5px;
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
.jd-section-body ul {
  padding-left: 18px;
  margin: 0;
}
.jd-section-body li {
  margin-bottom: 6px;
}
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
.jd-company-oneliner {
  padding: 0 20px 14px;
  font-size: 12.5px;
  color: #9ca3af;
  line-height: 1.5;
}

.jd-outreach-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.jd-outreach-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #4b5563;
  padding: 8px 12px;
  background: #fafbfc;
  border-radius: 8px;
}
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
.jd-log-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  color: #7c3aed;
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px 0;
  font-family: inherit;
  margin-top: 4px;
}
.jd-log-btn:hover { text-decoration: underline; }

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

.jd-log-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}
.jd-log-modal {
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 420px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.jd-log-modal h3 {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
}
.jd-log-contact-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 8px;
  transition: all 0.12s;
}
.jd-log-contact-row:hover {
  border-color: #7c3aed;
  background: #faf8ff;
}
.jd-log-contact-row.selected {
  border-color: #7c3aed;
  background: #f5f3ff;
}
.jd-log-contact-name { font-weight: 500; font-size: 13px; }
.jd-log-contact-title { font-size: 12px; color: #9ca3af; }
.jd-log-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.jd-log-actions button {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #4b5563;
  transition: all 0.12s;
}
.jd-log-actions button.primary {
  background: #7c3aed;
  color: #fff;
  border-color: #7c3aed;
}
.jd-log-actions button.primary:hover { background: #6d28d9; }
.jd-log-actions button.primary:disabled { opacity: 0.5; }

.jd-right-scroll {
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  position: sticky;
  top: 24px;
}
@media (max-width: 1023px) {
  .jd-right-scroll { max-height: none; position: static; }
}
`;

export function JobDetails({ submissionId, onNavigate }: JobDetailsProps) {
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [generatedMessages, setGeneratedMessages] = useState<{ [key: number]: boolean }>({});
  const [showFullJD, setShowFullJD] = useState(false);
  const [showCompanyDesc, setShowCompanyDesc] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logSelectedContact, setLogSelectedContact] = useState<number | null>(null);

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

  const emailStatusConfig = {
    valid: { icon: CheckCircle, text: "Verified" },
    risky: { icon: AlertTriangle, text: "Risky" },
    invalid: { icon: XCircle, text: "Invalid" },
    unknown: { icon: HelpCircle, text: "Unverified" },
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
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

  const handleGenerateMessages = (contactId: number) => {
    setGeneratedMessages({ ...generatedMessages, [contactId]: true });
    setSelectedContact(contactId);
  };

  const handleViewMessages = (contactId: number) => {
    setSelectedContact(contactId);
  };

  const handleStatusChange = (newStatus: string) => {
    statusMutation.mutate(newStatus);
    setOpenStatusDropdown(false);
  };

  const getEmailMessage = (contactName: string, jobTitle?: string | null, companyName?: string | null) => ({
    subject: `Excited About ${jobTitle || "This Role"} at ${companyName || "Your Company"}`,
    body: `Hi ${contactName.split(" ")[0]},\n\nI hope this message finds you well. I came across the ${jobTitle || "position"} at ${companyName || "your company"}, and I'm very excited about the opportunity to contribute to your team.\n\nWith over 5 years of experience in product management, particularly in B2B SaaS environments, I believe I would be a strong fit for this role. I've successfully led cross-functional teams to deliver innovative products that have driven significant business growth.\n\nI'm particularly drawn to ${companyName || "your company"}'s mission and the opportunity to work on cutting-edge products. My background in enterprise product management aligns well with the requirements outlined in the job description.\n\nI'd love to discuss how my experience and skills could benefit your team. Would you be available for a brief call next week?\n\nThank you for your time and consideration.\n\nBest regards,\n[Your Name]\n[Your LinkedIn Profile]\n[Your Contact Info]`,
  });

  const getLinkedInMessage = (contactName: string, jobTitle?: string | null, companyName?: string | null) => ({
    body: `Hi ${contactName.split(" ")[0]},\n\nI noticed you're recruiting for the ${jobTitle || "position"} at ${companyName || "your company"}. With 5+ years in product management and a strong B2B SaaS background, I'm excited about this opportunity.\n\nI'd love to learn more about the role and share how my experience could benefit your team. Are you available for a quick chat?\n\nThanks!\n[Your Name]`,
  });

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

  const parsed = parseOpenAIData(submission.openaiResponseRaw);
  const { main: mainTitle, sub: subTitle } = splitTitle(submission.jobTitle);
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
  const truncatedJD = rawJD.length > 400 ? rawJD.slice(0, 400) + "..." : rawJD;

  return (
    <div className="jd-root">
      <style>{css}</style>

      <button className="jd-back" onClick={() => onNavigate("job-history")}>
        <ArrowLeft className="w-4 h-4" /> Back to Job History
      </button>

      <div className="jd-grid">
        {/* ── LEFT COLUMN ── */}
        <div className="jd-left">

          {/* Section 1: Job Summary Card */}
          <div className="jd-card">
            <div className="jd-card-inner">
              <h1 className="jd-summary-title">{mainTitle}</h1>
              {subTitle && <div className="jd-summary-sub">{subTitle}</div>}

              <div className="jd-meta-grid">
                <div className="jd-meta-item">
                  <Building2 size={15} />
                  <span>{submission.companyName || "Unknown Company"}</span>
                </div>
                <div className="jd-meta-item">
                  <MapPin size={15} />
                  <span>{parsed.location || "Location not specified"}</span>
                </div>
                {parsed.department && (
                  <div className="jd-meta-item">
                    <Briefcase size={15} />
                    <span>{parsed.department}</span>
                  </div>
                )}
                {parsed.reportsTo && (
                  <div className="jd-meta-item">
                    <Users size={15} />
                    <span className="jd-meta-label">Reports to:</span> {parsed.reportsTo}
                  </div>
                )}
                {companyWebsite && (
                  <div className="jd-meta-item">
                    <ExternalLink size={15} />
                    <a href={companyWebsite} target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed", textDecoration: "none" }}>
                      {submission.companyDomain}
                    </a>
                  </div>
                )}
              </div>

              <div className="jd-status-row">
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
                          className={`jd-status-opt ${submission.status === s.value ? "active" : ""}`}
                          onClick={() => handleStatusChange(s.value)}
                        >
                          <span className="jd-status-dot" style={{ backgroundColor: s.dot }} />
                          {s.display}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="jd-submitted">
                  <Calendar size={13} />
                  {formatDate(submission.submittedAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Outreach Tracking */}
          <div className="jd-card">
            <div className="jd-card-inner">
              <div className="jd-section-title" style={{ marginBottom: 12 }}>
                <Mail size={15} />
                Outreach Progress
              </div>

              {contactedContacts.length > 0 ? (
                <div className="jd-outreach-list">
                  {contactedContacts.map(c => (
                    <div key={c.id} className="jd-outreach-item">
                      <div className="jd-outreach-icon"><Mail size={14} /></div>
                      <div>
                        <div className="jd-outreach-name">{c.name || "Unknown"}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.title || ""}</div>
                      </div>
                      <div className="jd-outreach-date">
                        {c.lastContactedAt ? formatDate(c.lastContactedAt) : "Contacted"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0 8px" }}>No outreach logged yet</p>
              )}

              {notContactedContacts.length > 0 && (
                <button className="jd-log-btn" onClick={() => setLogModalOpen(true)}>
                  <Plus size={14} /> Log outreach
                </button>
              )}

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f0f3" }}>
                <div className="jd-section-title" style={{ marginBottom: 8, fontSize: 13 }}>
                  <FileText size={14} />
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
          </div>

          {/* Section 3: Job Description (collapsible) */}
          <div className="jd-card">
            <div className="jd-section-header" onClick={() => setShowFullJD(!showFullJD)}>
              <div className="jd-section-title">
                <Briefcase size={15} />
                Job Description
              </div>
              <ChevronRight size={16} className={`jd-section-toggle ${showFullJD ? "open" : ""}`} />
            </div>

            {!showFullJD && hasResponsibilities && (
              <div className="jd-section-body">
                <strong style={{ fontSize: 12, color: "#1e1e2d", textTransform: "uppercase", letterSpacing: "0.4px" }}>Key Responsibilities</strong>
                <ul style={{ marginTop: 8 }}>
                  {parsed.responsibilities.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                <button className="jd-show-more" onClick={(e) => { e.stopPropagation(); setShowFullJD(true); }}>
                  Show full description <ChevronDown size={14} />
                </button>
              </div>
            )}

            {!showFullJD && !hasResponsibilities && (
              <div className="jd-section-body">
                <div style={{ whiteSpace: "pre-wrap" }}>{truncatedJD}</div>
                {rawJD.length > 400 && (
                  <button className="jd-show-more" onClick={(e) => { e.stopPropagation(); setShowFullJD(true); }}>
                    Show full description <ChevronDown size={14} />
                  </button>
                )}
              </div>
            )}

            {showFullJD && (
              <div className="jd-section-body">
                {hasResponsibilities && (
                  <>
                    <strong style={{ fontSize: 12, color: "#1e1e2d", textTransform: "uppercase", letterSpacing: "0.4px" }}>Key Responsibilities</strong>
                    <ul style={{ marginTop: 8 }}>
                      {parsed.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                )}
                {parsed.requirements.length > 0 && (
                  <>
                    <strong style={{ fontSize: 12, color: "#1e1e2d", textTransform: "uppercase", letterSpacing: "0.4px", display: "block", marginTop: 16 }}>Requirements</strong>
                    <ul style={{ marginTop: 8 }}>
                      {parsed.requirements.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                )}
                {parsed.jobDescription && !hasResponsibilities && (
                  <div style={{ whiteSpace: "pre-wrap" }}>{parsed.jobDescription}</div>
                )}
                {!hasResponsibilities && !parsed.jobDescription && (
                  <div style={{ whiteSpace: "pre-wrap" }}>{rawJD}</div>
                )}
                <button className="jd-show-more" onClick={(e) => { e.stopPropagation(); setShowFullJD(false); }}>
                  Show less <ChevronDown size={14} style={{ transform: "rotate(180deg)" }} />
                </button>
              </div>
            )}
          </div>

          {/* Section 4: About Company (collapsible, collapsed by default) */}
          {companyDesc && (
            <div className="jd-card">
              <div className="jd-section-header" onClick={() => setShowCompanyDesc(!showCompanyDesc)}>
                <div className="jd-section-title">
                  <Building2 size={15} />
                  About {submission.companyName || "Company"}
                </div>
                <ChevronRight size={16} className={`jd-section-toggle ${showCompanyDesc ? "open" : ""}`} />
              </div>
              {!showCompanyDesc && (
                <div className="jd-company-oneliner">
                  {companyDesc.length > 120 ? companyDesc.slice(0, 120) + "..." : companyDesc}
                </div>
              )}
              {showCompanyDesc && (
                <div className="jd-section-body" style={{ whiteSpace: "pre-wrap" }}>
                  {companyDesc}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Contacts ── */}
        <div className="jd-right-scroll">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1e1e2d", margin: 0 }}>Contacts</h2>
              <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
                {validContacts} verified &middot; {recruiters} recruiters &middot; {hiringManagers} hiring managers
              </p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
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
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: activeFilter === f.key ? 600 : 400,
                    fontFamily: "inherit",
                    border: "none",
                    cursor: "pointer",
                    background: activeFilter === f.key ? "#7c3aed" : "#f3f4f6",
                    color: activeFilter === f.key ? "#fff" : "#6b7280",
                    transition: "all 0.12s",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="jd-card">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0f0f3" }}>
                  <th style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.4px", padding: "10px 16px" }}>Name</th>
                  <th style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.4px", padding: "10px 16px" }}>Email</th>
                  <th style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.4px", padding: "10px 16px" }}>Type</th>
                  <th style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.4px", padding: "10px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No contacts found</td></tr>
                ) : filteredContacts.map((contact, index) => {
                  const vs = contact.verificationStatus || "unknown";
                  const cfg = emailStatusConfig[vs as keyof typeof emailStatusConfig] || emailStatusConfig.unknown;
                  const StatusIcon = cfg.icon;
                  const hasGenerated = generatedMessages[contact.id];
                  const cType = contact.outreachBucket === "department_lead" ? "Hiring Mgr" : "Recruiter";

                  return (
                    <tr
                      key={contact.id}
                      style={{
                        borderBottom: index !== filteredContacts.length - 1 ? "1px solid #f4f4f7" : "none",
                        transition: "background 0.1s",
                        cursor: "pointer",
                      }}
                      onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafafd")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#1e1e2d", display: "flex", alignItems: "center", gap: 6 }}>
                              {contact.name || "Unknown"}
                              {contact.linkedinUrl && (
                                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="LinkedIn">
                                  <Linkedin size={13} style={{ color: "#0a66c2" }} />
                                </a>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>{contact.title || ""}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <StatusIcon className={`w-3.5 h-3.5 ${vs === "valid" ? "text-[#10b981]" : vs === "risky" ? "text-[#f59e0b]" : vs === "invalid" ? "text-[#ef4444]" : "text-[#9ca3af]"}`} />
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>{cfg.text}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 13, color: "#4b5563", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>{contact.email || "No email"}</span>
                          {contact.email && (
                            <button onClick={(e) => { e.stopPropagation(); copyToClipboard(contact.email!); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                              <Copy size={12} style={{ color: "#9ca3af" }} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          display: "inline-flex",
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          background: contact.outreachBucket === "recruiter" ? "#f5f3ff" : "#ecfeff",
                          color: contact.outreachBucket === "recruiter" ? "#7c3aed" : "#0891b2",
                        }}>
                          {cType}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {!hasGenerated ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleGenerateMessages(contact.id); }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                              fontFamily: "inherit", cursor: "pointer", border: "none",
                              background: "#7c3aed", color: "#fff",
                            }}
                          >
                            <Sparkles size={13} /> Draft
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewMessages(contact.id); }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                              fontFamily: "inherit", cursor: "pointer",
                              border: "1px solid #e5e7eb", background: "#fff", color: "#4b5563",
                            }}
                          >
                            <Eye size={13} /> View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ borderTop: "1px solid #f0f0f3", padding: 16, textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>Need more contacts?</p>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                fontFamily: "inherit", cursor: "pointer",
                border: "1px solid #7c3aed", background: "#fff", color: "#7c3aed",
              }}>
                <Plus size={15} /> Pull Additional Contacts
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Log Outreach Modal */}
      {logModalOpen && (
        <div className="jd-log-modal-overlay" onClick={() => setLogModalOpen(false)}>
          <div className="jd-log-modal" onClick={e => e.stopPropagation()}>
            <h3>Log Outreach</h3>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Select a contact to mark as emailed:</p>
            {notContactedContacts.map(c => (
              <div
                key={c.id}
                className={`jd-log-contact-row ${logSelectedContact === c.id ? "selected" : ""}`}
                onClick={() => setLogSelectedContact(c.id)}
              >
                <Mail size={15} style={{ color: "#9ca3af" }} />
                <div>
                  <div className="jd-log-contact-name">{c.name || "Unknown"}</div>
                  <div className="jd-log-contact-title">{c.title || ""}</div>
                </div>
              </div>
            ))}
            <div className="jd-log-actions">
              <button onClick={() => setLogModalOpen(false)}>Cancel</button>
              <button
                className="primary"
                disabled={!logSelectedContact || logOutreachMutation.isPending}
                onClick={() => logSelectedContact && logOutreachMutation.mutate(logSelectedContact)}
              >
                {logOutreachMutation.isPending ? "Saving..." : "Mark as Emailed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Preview Modal */}
      {selectedContact && selectedContactData && (
        <div className="jd-log-modal-overlay" onClick={() => setSelectedContact(null)}>
          <div style={{
            background: "#fff", borderRadius: 14, width: "100%", maxWidth: 640,
            maxHeight: "90vh", display: "flex", flexDirection: "column",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f0f0f3" }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Generated Messages</h3>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{selectedContactData.name} &middot; {selectedContactData.title}</p>
              </div>
              <button onClick={() => setSelectedContact(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={18} style={{ color: "#9ca3af" }} />
              </button>
            </div>

            <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ border: "1px solid #e8eaed", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fafbfc", borderBottom: "1px solid #f0f0f3" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1e1e2d" }}>
                    <Mail size={14} /> Email Message
                  </div>
                  <button
                    onClick={() => copyToClipboard(`Subject: ${getEmailMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).subject}\n\n${getEmailMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).body}`)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280", fontFamily: "inherit" }}
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Subject</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e1e2d", marginBottom: 12 }}>
                    {getEmailMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).subject}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Message</div>
                  <div style={{ fontSize: 13, color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "#fafbfc", padding: 14, borderRadius: 8 }}>
                    {getEmailMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).body}
                  </div>
                </div>
              </div>

              <div style={{ border: "1px solid #e8eaed", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fafbfc", borderBottom: "1px solid #f0f0f3" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#1e1e2d" }}>
                    <Linkedin size={14} /> LinkedIn Message
                  </div>
                  <button
                    onClick={() => copyToClipboard(getLinkedInMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).body)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280", fontFamily: "inherit" }}
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Message</div>
                  <div style={{ fontSize: 13, color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "#fafbfc", padding: 14, borderRadius: 8 }}>
                    {getLinkedInMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).body}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f0f3" }}>
              <button
                onClick={() => setSelectedContact(null)}
                style={{
                  width: "100%", padding: "10px", borderRadius: 8, fontSize: 13,
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
