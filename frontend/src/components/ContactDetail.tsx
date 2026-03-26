import {
  ArrowLeft,
  Mail,
  Linkedin,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Building2,
  Briefcase,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Save,
  FileText,
  Users,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

interface ContactDetailProps {
  onNavigate: (page: string, data?: any) => void;
  contactId?: number;
}

interface Contact {
  id: number;
  name: string | null;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  department: string | null;
  seniority: string | null;
  verificationStatus: string;
  contactStatus: string | null;
  lastContactedAt: string | null;
  outreachBucket: string | null;
  notes: string | null;
  generatedEmailMessage: string | null;
  generatedLinkedInMessage: string | null;
  emailDraft: string | null;
  linkedinMessage: string | null;
  jobSubmissionId: number;
  jobTitle?: string | null;
  companyName?: string | null;
  createdAt: string | null;
}

const VERIFICATION: Record<string, { label: string; dot: string; tooltip: string }> = {
  valid:   { label: "Verified",        dot: "#10b981", tooltip: "This email has been confirmed as a real, active inbox." },
  risky:   { label: "Likely Valid",    dot: "#3b82f6", tooltip: "This email follows the company's pattern and the domain accepts mail. It's worth sending — most corporate emails show this status." },
  invalid: { label: "Not Deliverable", dot: "#ef4444", tooltip: "This email bounced during verification. Try reaching out via LinkedIn instead." },
  unknown: { label: "Unconfirmed",     dot: "#9ca3af", tooltip: "We haven't been able to verify this email yet. Use with caution or try LinkedIn." },
};

const STATUSES = [
  { value: "not_contacted",       label: "Not Contacted",      dot: "#9ca3af" },
  { value: "email_sent",          label: "Email Sent",         dot: "#2563eb" },
  { value: "linkedin_sent",       label: "LinkedIn Sent",      dot: "#0a66c2" },
  { value: "awaiting_reply",      label: "Awaiting Reply",     dot: "#d97706" },
  { value: "follow_up_needed",    label: "Follow Up Needed",   dot: "#ea580c" },
  { value: "replied",             label: "Replied",            dot: "#059669" },
  { value: "interview_scheduled", label: "Interview Scheduled",dot: "#7c3aed" },
  { value: "not_interested",      label: "Not Interested",     dot: "#6b7280" },
];

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0][0]?.toUpperCase() || "?";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

const css = `
.cd-root {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  max-width: 820px;
  margin: 0 auto;
  padding: 24px;
  color: #1e1e2d;
  min-height: 100vh;
}
.cd-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}
.cd-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #7c3aed;
  cursor: pointer;
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
}
.cd-back:hover { text-decoration: underline; }
.cd-topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cd-card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}
.cd-card-inner { padding: 20px 24px; }

.cd-header-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.cd-avatar {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}
.cd-avatar.recruiter { background: #f3f0ff; color: #7c3aed; }
.cd-avatar.hiring { background: #ecfeff; color: #0891b2; }
.cd-header-info { flex: 1; min-width: 0; }
.cd-name {
  font-size: 20px;
  font-weight: 700;
  color: #1e1e2d;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 10px;
}
.cd-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  white-space: nowrap;
}
.cd-type-badge.recruiter { background: #f5f3ff; color: #7c3aed; }
.cd-type-badge.hiring { background: #ecfeff; color: #0891b2; }
.cd-title-line {
  font-size: 14px;
  color: #6b7280;
  margin-top: 2px;
}
.cd-company-line {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 1px;
}

.cd-contact-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f3;
}
.cd-contact-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #4b5563;
}
.cd-contact-row svg { color: #9ca3af; flex-shrink: 0; }
.cd-contact-row a {
  color: #7c3aed;
  text-decoration: none;
}
.cd-contact-row a:hover { text-decoration: underline; }
.cd-email-text {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
}
.cd-verification {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
}
.cd-verification .vdot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.cd-meta-row {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #6b7280;
}
.cd-meta-row svg { color: #9ca3af; }

.cd-sourced-row {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f0f0f3;
  font-size: 13px;
  color: #9ca3af;
}
.cd-sourced-link {
  color: #7c3aed;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.cd-sourced-link:hover { text-decoration: underline; }

.cd-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e1e2d;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.cd-status-wrap { position: relative; display: inline-block; }
.cd-status-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  background: #fff;
  transition: all 0.12s;
}
.cd-status-btn:hover { border-color: #d1d5db; }
.cd-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.cd-status-dd {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  z-index: 20;
  min-width: 200px;
  padding: 4px;
}
.cd-status-opt {
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
.cd-status-opt:hover { background: #f5f3ff; color: #7c3aed; }
.cd-status-opt.active { background: #f5f3ff; color: #7c3aed; font-weight: 600; }
.cd-last-contacted {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 10px;
}

.cd-tab-row {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
}
.cd-tab {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  border: none;
  cursor: pointer;
  transition: all 0.12s;
}
.cd-tab.active {
  background: #7c3aed;
  color: #fff;
}
.cd-tab.inactive {
  background: #f3f4f6;
  color: #6b7280;
}
.cd-tab.inactive:hover { background: #e5e7eb; }

.cd-msg-box {
  border: 1px solid #e8eaed;
  border-radius: 10px;
  overflow: hidden;
}
.cd-msg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #fafbfc;
  border-bottom: 1px solid #f0f0f3;
}
.cd-msg-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #9ca3af;
  font-weight: 600;
  margin-bottom: 6px;
}
.cd-msg-textarea {
  width: 100%;
  min-height: 160px;
  padding: 12px;
  border: none;
  font-size: 13px;
  font-family: inherit;
  color: #4b5563;
  resize: vertical;
  outline: none;
  line-height: 1.6;
  background: #fafbfc;
  border-radius: 8px;
}
.cd-msg-textarea:focus {
  box-shadow: inset 0 0 0 1px #7c3aed;
  background: #fff;
}
.cd-msg-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.cd-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
  border: none;
  white-space: nowrap;
}
.cd-btn.primary {
  background: #7c3aed;
  color: #fff;
}
.cd-btn.primary:hover { background: #6d28d9; }
.cd-btn.primary:disabled { opacity: 0.5; cursor: default; }
.cd-btn.secondary {
  background: #fff;
  color: #4b5563;
  border: 1px solid #e5e7eb;
}
.cd-btn.secondary:hover { border-color: #7c3aed; color: #7c3aed; }
.cd-btn.ghost {
  background: none;
  color: #7c3aed;
  border: none;
  padding: 4px 0;
}
.cd-btn.ghost:hover { text-decoration: underline; }

.cd-generate-cta {
  text-align: center;
  padding: 24px;
  background: #faf8ff;
  border-radius: 10px;
  border: 1px dashed #d8b4fe;
}
.cd-generate-cta p {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 12px;
}

.cd-notes-area {
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
.cd-notes-area:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.06);
}
.cd-notes-area::placeholder { color: #adb5bd; }

.cd-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.12s;
  text-decoration: none;
}
.cd-icon-btn:hover {
  border-color: #7c3aed;
  color: #7c3aed;
  background: #faf8ff;
}
.cd-icon-btn.linkedin:hover {
  border-color: #0a66c2;
  color: #0a66c2;
  background: #f0f7ff;
}
.cd-copied {
  color: #10b981 !important;
  border-color: #10b981 !important;
}
`;

export function ContactDetail({ onNavigate, contactId }: ContactDetailProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"email" | "linkedin">("email");
  const [emailDraft, setEmailDraft] = useState("");
  const [linkedinDraft, setLinkedinDraft] = useState("");
  const [notesValue, setNotesValue] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const { data: contact, isLoading, error } = useQuery<Contact>({
    queryKey: ["/api/contacts", contactId],
    enabled: !!contactId,
  });

  useEffect(() => {
    if (contact) {
      setNotesValue(contact.notes || "");
      setNotesDirty(false);
      if (contact.generatedEmailMessage || contact.emailDraft) {
        setEmailDraft(contact.emailDraft || contact.generatedEmailMessage || "");
      }
      if (contact.generatedLinkedInMessage || contact.linkedinMessage) {
        setLinkedinDraft(contact.linkedinMessage || contact.generatedLinkedInMessage || "");
      }
    }
  }, [contact]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!contactId) return;
      const payload: any = { contactStatus: newStatus };
      if (newStatus === "email_sent" || newStatus === "linkedin_sent") {
        payload.lastContactedAt = new Date().toISOString();
      }
      await apiRequest("PATCH", `/api/contacts/${contactId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId] });
      setStatusOpen(false);
    },
  });

  const notesMutation = useMutation({
    mutationFn: async (notes: string) => {
      if (!contactId) return;
      await apiRequest("PATCH", `/api/contacts/${contactId}`, { notes });
    },
    onSuccess: () => {
      setNotesDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (type: "email" | "linkedin") => {
      if (!contactId) throw new Error("No contact");
      const res = await apiRequest("POST", `/api/contacts/${contactId}/generate-message`, {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.emailContent) setEmailDraft(data.emailContent);
      if (data.linkedinContent) setLinkedinDraft(data.linkedinContent);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId] });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!contactId) return;
      await apiRequest("PATCH", `/api/contacts/${contactId}`, {
        emailDraft: emailDraft,
        linkedinMessage: linkedinDraft,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId] });
    },
  });

  const markSentMutation = useMutation({
    mutationFn: async (channel: "email" | "linkedin") => {
      if (!contactId) return;
      await apiRequest("PATCH", `/api/contacts/${contactId}`, {
        contactStatus: channel === "email" ? "email_sent" : "linkedin_sent",
        lastContactedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId] });
    },
  });

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (!contactId) {
    return (
      <div className="cd-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{css}</style>
        <div style={{ textAlign: "center" }}>
          <AlertCircle size={40} style={{ color: "#9ca3af", margin: "0 auto 12px" }} />
          <p style={{ color: "#9ca3af" }}>No contact selected</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="cd-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{css}</style>
        <div style={{ textAlign: "center" }}>
          <Loader2 className="w-8 h-8 text-[#7c3aed] animate-spin" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading contact...</p>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="cd-root">
        <style>{css}</style>
        <button className="cd-back" onClick={() => onNavigate("all-contacts")}>
          <ArrowLeft size={16} /> Back to Contacts
        </button>
        <div className="cd-card" style={{ marginTop: 20 }}>
          <div className="cd-card-inner" style={{ textAlign: "center", padding: 40 }}>
            <AlertCircle size={40} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
            <p style={{ color: "#ef4444", fontWeight: 600 }}>Failed to load contact</p>
            <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
              {error instanceof Error ? error.message : "Contact not found"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isRecruiter = contact.outreachBucket === "recruiter";
  const initials = getInitials(contact.name);
  const v = VERIFICATION[contact.verificationStatus] || VERIFICATION.unknown;
  const currentStatusVal = contact.contactStatus || "not_contacted";
  const currentStatus = STATUSES.find(s => s.value === currentStatusVal) || STATUSES[0];
  const hasEmail = !!(contact.generatedEmailMessage || contact.emailDraft || emailDraft);
  const hasLinkedin = !!(contact.generatedLinkedInMessage || contact.linkedinMessage || linkedinDraft);

  return (
    <div className="cd-root">
      <style>{css}</style>

      {/* Top Bar */}
      <div className="cd-topbar">
        <button className="cd-back" onClick={() => onNavigate("all-contacts")}>
          <ArrowLeft size={16} /> Back to Contacts
        </button>
        <div className="cd-topbar-actions">
          {contact.linkedinUrl && (
            <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="cd-icon-btn linkedin" title="Open LinkedIn">
              <Linkedin size={16} />
            </a>
          )}
          {contact.email && (
            <button
              className={`cd-icon-btn ${copied ? "cd-copied" : ""}`}
              onClick={() => copyToClipboard(contact.email!)}
              title="Copy email"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Contact Header Card */}
      <div className="cd-card">
        <div className="cd-card-inner">
          <div className="cd-header-row">
            <div className={`cd-avatar ${isRecruiter ? "recruiter" : "hiring"}`}>
              {initials}
            </div>
            <div className="cd-header-info">
              <div className="cd-name">
                {contact.name || "Unknown Contact"}
                <span className={`cd-type-badge ${isRecruiter ? "recruiter" : "hiring"}`}>
                  {isRecruiter ? "Recruiter" : "Hiring Mgr"}
                </span>
              </div>
              <div className="cd-title-line">{contact.title || "Unknown Title"}</div>
              <div className="cd-company-line">{contact.companyName || "Unknown Company"}</div>
            </div>
          </div>

          <div className="cd-contact-grid">
            <div className="cd-contact-row">
              <Mail size={15} />
              <span className="cd-email-text">{contact.email || "No email"}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cd-verification cursor-default">
                    <span className="vdot" style={{ backgroundColor: v.dot }} />
                    <span style={{ color: v.dot }}>{v.label}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg max-w-[240px] leading-relaxed shadow-lg"
                >
                  {v.tooltip}
                </TooltipContent>
              </Tooltip>
            </div>
            {contact.linkedinUrl && (
              <div className="cd-contact-row">
                <Linkedin size={15} />
                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                  {contact.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
                </a>
              </div>
            )}
            <div className="cd-meta-row">
              {contact.department && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Briefcase size={14} /> {contact.department}
                </span>
              )}
              {contact.seniority && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Users size={14} /> {contact.seniority}
                </span>
              )}
            </div>
          </div>

          <div className="cd-sourced-row">
            Sourced for:{" "}
            <span
              className="cd-sourced-link"
              onClick={() => onNavigate("job-details", { submissionId: contact.jobSubmissionId })}
            >
              {contact.jobTitle || "Unknown"} at {contact.companyName || "Unknown"}
              <ExternalLink size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* Outreach Status */}
      <div className="cd-card">
        <div className="cd-card-inner">
          <div className="cd-section-title">
            <Mail size={15} />
            Outreach Status
          </div>

          <div className="cd-status-wrap" ref={statusRef}>
            <button className="cd-status-btn" onClick={() => setStatusOpen(!statusOpen)} disabled={statusMutation.isPending}>
              <span className="cd-status-dot" style={{ backgroundColor: currentStatus.dot }} />
              {statusMutation.isPending ? "Updating..." : currentStatus.label}
              <ChevronDown size={14} />
            </button>
            {statusOpen && (
              <div className="cd-status-dd">
                {STATUSES.map(s => (
                  <button
                    key={s.value}
                    className={`cd-status-opt ${currentStatusVal === s.value ? "active" : ""}`}
                    onClick={() => statusMutation.mutate(s.value)}
                  >
                    <span className="cd-status-dot" style={{ backgroundColor: s.dot }} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="cd-last-contacted">
            Last contacted: {formatDate(contact.lastContactedAt)}
          </div>
        </div>
      </div>

      {/* Outreach Drafts */}
      <div className="cd-card">
        <div className="cd-card-inner">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="cd-section-title" style={{ marginBottom: 0 }}>
              <FileText size={15} />
              Outreach Drafts
            </div>
            <button
              className="cd-btn primary"
              onClick={() => generateMutation.mutate(activeTab)}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Generating...</>
              ) : (
                <><Sparkles size={14} /> Generate</>
              )}
            </button>
          </div>

          <div className="cd-tab-row">
            <button className={`cd-tab ${activeTab === "email" ? "active" : "inactive"}`} onClick={() => setActiveTab("email")}>
              <Mail size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />
              Email
            </button>
            <button className={`cd-tab ${activeTab === "linkedin" ? "active" : "inactive"}`} onClick={() => setActiveTab("linkedin")}>
              <Linkedin size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />
              LinkedIn
            </button>
          </div>

          {activeTab === "email" && (
            <>
              {hasEmail ? (
                <div className="cd-msg-box">
                  <div style={{ padding: 16 }}>
                    <div className="cd-msg-label">Message</div>
                    <textarea
                      className="cd-msg-textarea"
                      value={emailDraft}
                      onChange={e => setEmailDraft(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="cd-generate-cta">
                  <p>No email draft yet. Click "Generate" to create a personalized outreach email.</p>
                </div>
              )}
              {hasEmail && (
                <div className="cd-msg-actions">
                  <button className="cd-btn secondary" onClick={() => {
                    const text = emailDraft;
                    copyToClipboard(text);
                  }}>
                    <Copy size={13} /> Copy to Clipboard
                  </button>
                  <button
                    className="cd-btn secondary"
                    onClick={() => markSentMutation.mutate("email")}
                    disabled={markSentMutation.isPending}
                  >
                    <Check size={13} /> {markSentMutation.isPending ? "Saving..." : "Mark as Sent"}
                  </button>
                  <button
                    className="cd-btn ghost"
                    onClick={() => saveDraftMutation.mutate()}
                    disabled={saveDraftMutation.isPending}
                    style={{ marginLeft: "auto" }}
                  >
                    <Save size={13} /> {saveDraftMutation.isPending ? "Saving..." : "Save Edits"}
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === "linkedin" && (
            <>
              {hasLinkedin ? (
                <div className="cd-msg-box">
                  <div style={{ padding: 16 }}>
                    <div className="cd-msg-label">Message</div>
                    <textarea
                      className="cd-msg-textarea"
                      value={linkedinDraft}
                      onChange={e => setLinkedinDraft(e.target.value)}
                      style={{ minHeight: 100 }}
                    />
                  </div>
                </div>
              ) : (
                <div className="cd-generate-cta">
                  <p>No LinkedIn draft yet. Click "Generate" to create a personalized connection message.</p>
                </div>
              )}
              {hasLinkedin && (
                <div className="cd-msg-actions">
                  <button className="cd-btn secondary" onClick={() => copyToClipboard(linkedinDraft)}>
                    <Copy size={13} /> Copy to Clipboard
                  </button>
                  <button
                    className="cd-btn secondary"
                    onClick={() => markSentMutation.mutate("linkedin")}
                    disabled={markSentMutation.isPending}
                  >
                    <Check size={13} /> {markSentMutation.isPending ? "Saving..." : "Mark as Sent"}
                  </button>
                  <button
                    className="cd-btn ghost"
                    onClick={() => saveDraftMutation.mutate()}
                    disabled={saveDraftMutation.isPending}
                    style={{ marginLeft: "auto" }}
                  >
                    <Save size={13} /> {saveDraftMutation.isPending ? "Saving..." : "Save Edits"}
                  </button>
                </div>
              )}
            </>
          )}

          {generateMutation.isError && (
            <div style={{ marginTop: 12, padding: 12, background: "#fef2f2", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
              Failed to generate message. Please try again.
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="cd-card">
        <div className="cd-card-inner">
          <div className="cd-section-title">
            <Building2 size={15} />
            Notes
          </div>
          <textarea
            className="cd-notes-area"
            placeholder="Add notes about this contact..."
            value={notesValue}
            onChange={e => { setNotesValue(e.target.value); setNotesDirty(true); }}
            onBlur={() => {
              if (notesDirty && notesValue !== (contact.notes || "")) {
                notesMutation.mutate(notesValue);
              }
            }}
          />
          {notesDirty && notesValue !== (contact.notes || "") && (
            <button
              className="cd-btn primary"
              style={{ marginTop: 8 }}
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
  );
}
