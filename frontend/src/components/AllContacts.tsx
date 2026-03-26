import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Plus } from "lucide-react";
import { STATUS_COLORS, VERIFICATION_COLORS, getContactStatusStyle, getVerificationStyle } from "../lib/statusColors";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

interface AllContactsProps {
  onNavigate: (page: string, data?: any) => void;
}

interface Contact {
  id: number;
  name: string | null;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  verificationStatus: string;
  jobSubmissionId: number;
  outreachBucket: string | null;
  contactStatus: string | null;
  createdAt: string;
  jobTitle?: string | null;
  companyName?: string | null;
  generatedEmailMessage?: string | null;
}

const css = `
  .contacts-root {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    max-width: 1120px;
    margin: 0 auto;
    padding: 32px 24px;
    color: #1e1e2d;
    min-height: 100vh;
  }
  .contacts-header { margin-bottom: 20px; }
  .contacts-header h1 { font-size: 21px; font-weight: 700; color: #1e1e2d; }
  .contacts-header p { font-size: 13px; color: #7c8495; margin-top: 4px; }
  .contacts-header p span.sep { color: #d1d5db; margin: 0 6px; }

  .contacts-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 220px;
  }
  .search-wrap svg {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
  }
  .search-wrap input {
    width: 100%;
    padding: 8px 12px 8px 36px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    color: #1e1e2d;
    background: #fff;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .search-wrap input:focus {
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.06);
  }
  .search-wrap input::placeholder { color: #adb5bd; }

  .toolbar-select {
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    color: #4b5563;
    background: #fff;
    cursor: pointer;
    outline: none;
  }

  .filter-row {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 13px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .pill:hover { background: #f9fafb; }
  .pill.active {
    border-color: #7c3aed;
    background: #f5f3ff;
    color: #7c3aed;
    font-weight: 600;
  }
  .pill .count {
    font-size: 11px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #94a3b8;
  }
  .pill.active .count {
    background: #ede9fe;
    color: #7c3aed;
  }

  .contacts-table-wrap {
    background: #fff;
    border: 1px solid #e8eaed;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }

  .contacts-table-wrap table {
    width: 100%;
    border-collapse: collapse;
  }

  .contacts-table-wrap thead th {
    padding: 10px 16px;
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    text-align: left;
    border-bottom: 1px solid #f0f0f3;
    background: #fafbfc;
    white-space: nowrap;
    user-select: none;
  }

  .contacts-table-wrap tbody tr {
    border-bottom: 1px solid #f4f4f7;
    transition: background-color 0.1s;
    cursor: pointer;
  }
  .contacts-table-wrap tbody tr:last-child { border-bottom: none; }
  .contacts-table-wrap tbody tr:hover { background: #fafafd; }

  .contacts-table-wrap tbody td {
    padding: 12px 16px;
    font-size: 13px;
    color: #4b5563;
    vertical-align: middle;
    white-space: nowrap;
  }

  .name-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ct-avatar {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .ct-avatar.recruiter { background: #f3f0ff; color: #7c3aed; }
  .ct-avatar.hiring { background: #ecfeff; color: #0891b2; }
  .name-text .full-name {
    font-weight: 600;
    font-size: 13.5px;
    color: #1e1e2d;
    line-height: 1.2;
  }
  .name-text .role-title {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 1px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .email-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .email-text {
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 12.5px;
    color: #4b5563;
  }
  .dot-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }
  .dot-badge .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .type-badge {
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
  .type-badge.recruiter { background: #f5f3ff; color: #7c3aed; }
  .type-badge.hiring { background: #ecfeff; color: #0891b2; }

  .actions-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .icon-btn {
    width: 30px;
    height: 30px;
    border-radius: 6px;
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
  .icon-btn:hover {
    border-color: #7c3aed;
    color: #7c3aed;
    background: #faf8ff;
  }
  .icon-btn.linkedin:hover {
    border-color: #0a66c2;
    color: #0a66c2;
    background: #f0f7ff;
  }
  .gen-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.12s;
    border: none;
    white-space: nowrap;
  }
  .gen-btn.primary {
    background: #7c3aed;
    color: #fff;
    box-shadow: 0 1px 2px rgba(124,58,237,0.15);
  }
  .gen-btn.primary:hover { background: #6d28d9; }
  .gen-btn.secondary {
    background: #fff;
    color: #7c3aed;
    border: 1.5px solid #7c3aed;
  }
  .gen-btn.secondary:hover { background: #f5f3ff; }

  .sourced-label {
    font-size: 12px;
    color: #9ca3af;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sourced-label .job-link {
    color: #7c3aed;
    font-weight: 500;
    cursor: pointer;
  }
  .sourced-label .job-link:hover { text-decoration: underline; }

  .table-footer {
    text-align: center;
    padding: 14px;
    font-size: 12px;
    color: #9ca3af;
  }

  .empty-state {
    text-align: center;
    padding: 56px 20px;
    color: #9ca3af;
    font-size: 14px;
  }

  .contacts-cards {
    display: none;
  }

  @media (max-width: 1023px) {
    .contacts-table-wrap { display: none; }
    .table-footer { display: none; }
    .contacts-cards { display: flex; flex-direction: column; gap: 12px; }
    .contact-card {
      background: #fff;
      border: 1px solid #e8eaed;
      border-radius: 12px;
      padding: 16px;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .card-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
      font-size: 13px;
    }
    .card-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card-actions {
      display: flex;
      gap: 8px;
    }
    .card-actions .gen-btn {
      flex: 1;
      justify-content: center;
    }
  }
`;

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0][0]?.toUpperCase() || "?";
}

export function AllContacts({ onNavigate }: AllContactsProps) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/all"],
  });

  const stats = {
    total: contacts.length,
    verified: contacts.filter(c => c.verificationStatus === "valid").length,
    needsOutreach: contacts.filter(c => !c.contactStatus || c.contactStatus === "not_contacted").length,
    recruiters: contacts.filter(c => c.outreachBucket === "recruiter").length,
    hiring: contacts.filter(c => c.outreachBucket === "department_lead").length,
  };

  const filters = [
    { key: "all", label: "All", count: stats.total },
    { key: "needs_outreach", label: "Needs Outreach", count: stats.needsOutreach },
    { key: "recruiters", label: "Recruiters", count: stats.recruiters },
    { key: "hiring", label: "Hiring Managers", count: stats.hiring },
    { key: "verified", label: "Verified", count: stats.verified },
  ];

  const filtered = contacts.filter(c => {
    if (filter === "recruiters" && c.outreachBucket !== "recruiter") return false;
    if (filter === "hiring" && c.outreachBucket !== "department_lead") return false;
    if (filter === "verified" && c.verificationStatus !== "valid") return false;
    if (filter === "needs_outreach" && c.contactStatus && c.contactStatus !== "not_contacted") return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.name?.toLowerCase() || "").includes(q)
        || (c.companyName?.toLowerCase() || "").includes(q)
        || (c.title?.toLowerCase() || "").includes(q)
        || (c.email?.toLowerCase() || "").includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "recent") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === "company") return (a.companyName || "").localeCompare(b.companyName || "");
    if (sort === "name") return (a.name || "").localeCompare(b.name || "");
    return 0;
  });

  if (isLoading) {
    return (
      <div className="contacts-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{css}</style>
        <div style={{ textAlign: "center" }}>
          <Loader2 className="w-8 h-8 text-[#7c3aed] animate-spin" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading contacts...</p>
        </div>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="contacts-root">
        <style>{css}</style>
        <div className="contacts-header">
          <h1>Contacts</h1>
        </div>
        <div style={{ textAlign: "center", padding: "80px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Search style={{ width: 28, height: 28, color: "#7c3aed" }} />
          </div>
          <h3 style={{ color: "#0f172a", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No contacts yet</h3>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
            Submit a job posting to automatically discover recruiter and hiring manager contacts.
          </p>
          <button
            onClick={() => onNavigate("search")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Start New Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contacts-root">
      <style>{css}</style>

      <div className="contacts-header">
        <h1>Contacts</h1>
        <p>
          {stats.total} total
          <span className="sep">&middot;</span>
          {stats.verified} verified
          <span className="sep">&middot;</span>
          {stats.needsOutreach} need outreach
        </p>
      </div>

      <div className="contacts-toolbar">
        <div className="search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="toolbar-select" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="recent">Most Recent</option>
          <option value="company">Company</option>
          <option value="name">Name</option>
        </select>
      </div>

      <div className="filter-row">
        {filters.map(f => (
          <button
            key={f.key}
            className={`pill ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="count">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="contacts-table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: "25%" }}>Name</th>
              <th style={{ width: "14%" }}>Company</th>
              <th style={{ width: "22%" }}>Email</th>
              <th style={{ width: "10%" }}>Type</th>
              <th style={{ width: "12%" }}>Status</th>
              <th style={{ width: "12%" }}>Sourced For</th>
              <th style={{ width: "5%", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length > 0 ? sorted.map(c => {
              const v = getVerificationStyle(c.verificationStatus);
              const s = getContactStatusStyle(c.contactStatus);
              const initials = getInitials(c.name);
              const isRecruiter = c.outreachBucket === "recruiter";
              const hasDraft = !!c.generatedEmailMessage;

              return (
                <tr key={c.id} onClick={() => onNavigate("contact-detail", { contactId: c.id })}>
                  <td>
                    <div className="name-cell">
                      <div className={`ct-avatar ${isRecruiter ? "recruiter" : "hiring"}`}>
                        {initials}
                      </div>
                      <div className="name-text">
                        <div className="full-name">{c.name || "Unknown"}</div>
                        <div className="role-title" title={c.title || ""}>{c.title || "Unknown Title"}</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ fontWeight: 500, color: "#1e1e2d" }}>{c.companyName || "Unknown"}</td>

                  <td>
                    <div className="email-cell">
                      <span className="email-text">{c.email || "—"}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="dot-badge cursor-default">
                            <span className="dot" style={{ backgroundColor: v.dot }} />
                            <span style={{ color: v.color }}>{v.label}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg max-w-[240px] leading-relaxed shadow-lg">
                          {v.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </td>

                  <td>
                    <span className={`type-badge ${isRecruiter ? "recruiter" : "hiring"}`}>
                      {isRecruiter ? "Recruiter" : "Hiring Mgr"}
                    </span>
                  </td>

                  <td>
                    <span className="status-badge" style={{ color: s.color, backgroundColor: s.bg }}>
                      {s.label}
                    </span>
                  </td>

                  <td>
                    <div className="sourced-label">
                      <span
                        className="job-link"
                        onClick={e => { e.stopPropagation(); onNavigate("job-details", { submissionId: c.jobSubmissionId }); }}
                        title={c.jobTitle || ""}
                      >
                        {c.jobTitle || "Unknown"}
                      </span>
                    </div>
                  </td>

                  <td onClick={e => e.stopPropagation()}>
                    <div className="actions-cell">
                      {c.linkedinUrl && (
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="icon-btn linkedin" title="LinkedIn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        </a>
                      )}
                      <button
                        className={`gen-btn ${hasDraft ? "secondary" : "primary"}`}
                        title={hasDraft ? "View existing draft" : "Generate outreach"}
                        onClick={() => onNavigate("contact-detail", { contactId: c.id })}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        {hasDraft ? "View Draft" : "Draft"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={7} className="empty-state">No contacts match your filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="contacts-cards">
        {sorted.length > 0 ? sorted.map(c => {
          const v = getVerificationStyle(c.verificationStatus);
          const s = getContactStatusStyle(c.contactStatus);
          const initials = getInitials(c.name);
          const isRecruiter = c.outreachBucket === "recruiter";
          const hasDraft = !!c.generatedEmailMessage;

          return (
            <div key={c.id} className="contact-card" onClick={() => onNavigate("contact-detail", { contactId: c.id })}>
              <div className="card-header">
                <div className={`ct-avatar ${isRecruiter ? "recruiter" : "hiring"}`}>
                  {initials}
                </div>
                <div className="name-text" style={{ flex: 1 }}>
                  <div className="full-name">{c.name || "Unknown"}</div>
                  <div className="role-title">{c.title || "Unknown Title"}</div>
                </div>
                <span className={`type-badge ${isRecruiter ? "recruiter" : "hiring"}`}>
                  {isRecruiter ? "Recruiter" : "Hiring Mgr"}
                </span>
              </div>
              <div className="card-meta">
                <div className="card-meta-row">
                  <span style={{ fontWeight: 500, color: "#1e1e2d" }}>{c.companyName || "Unknown"}</span>
                  <span className="status-badge" style={{ color: s.color, backgroundColor: s.bg }}>{s.label}</span>
                </div>
                <div className="card-meta-row">
                  <span className="email-text" style={{ fontSize: 12 }}>{c.email || "—"}</span>
                  <span className="dot-badge">
                    <span className="dot" style={{ backgroundColor: v.dot }} />
                    <span style={{ color: v.dot }}>{v.label}</span>
                  </span>
                </div>
                <div className="card-meta-row">
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    Sourced for{" "}
                    <span
                      className="job-link"
                      style={{ color: "#7c3aed", fontWeight: 500, cursor: "pointer" }}
                      onClick={e => { e.stopPropagation(); onNavigate("job-details", { submissionId: c.jobSubmissionId }); }}
                    >
                      {c.jobTitle || "Unknown"}
                    </span>
                  </span>
                </div>
              </div>
              <div className="card-actions" onClick={e => e.stopPropagation()}>
                {c.linkedinUrl && (
                  <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="icon-btn linkedin" title="LinkedIn" style={{ flex: "0 0 30px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                )}
                <button
                  className={`gen-btn ${hasDraft ? "secondary" : "primary"}`}
                  onClick={() => onNavigate("contact-detail", { contactId: c.id })}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  {hasDraft ? "View Draft" : "Draft"}
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="empty-state">No contacts match your filters</div>
        )}
      </div>

      {sorted.length > 0 && (
        <div className="table-footer">
          Showing {sorted.length} of {stats.total} contacts
        </div>
      )}
    </div>
  );
}
