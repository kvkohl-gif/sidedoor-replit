import { useState } from "react";

// ============================================================
// Side Door — Contacts Table (Apollo-style clean columns)
// ============================================================
// Design reference: Apollo.io People table, HubSpot contacts,
// Attio, Clay.com — clean columnar layout, one data point per
// column, avatar + name stacked, everything scannable.
// ============================================================

const CONTACTS = [
  { id: 1, firstName: "Rayna", lastName: "Chen", title: "Senior Product Manager", company: "Quickbase", email: "rayna@quickbase.com", linkedinUrl: "https://linkedin.com/in/rayna-chen", verificationStatus: "risky", bucket: "department_lead", status: "not_contacted", sourcedFor: "Senior Product Manager", createdAt: "2026-01-14" },
  { id: 2, firstName: "Julius", lastName: "Wright", title: "Manager of Operations", company: "Quickbase", email: "julius@quickbase.com", linkedinUrl: "https://linkedin.com/in/julius", verificationStatus: "risky", bucket: "department_lead", status: "email_sent", sourcedFor: "Senior Product Manager", createdAt: "2026-01-14" },
  { id: 3, firstName: "Izabel", lastName: "Santos", title: "Talent Acquisition Partner", company: "Quickbase", email: "izabel@quickbase.com", linkedinUrl: null, verificationStatus: "valid", bucket: "recruiter", status: "not_contacted", sourcedFor: "Senior Product Manager", createdAt: "2026-01-14" },
  { id: 4, firstName: "Lina", lastName: "Okafor", title: "Talent Acquisition Partner", company: "Quickbase", email: "lina@quickbase.com", linkedinUrl: "https://linkedin.com/in/lina", verificationStatus: "unknown", bucket: "recruiter", status: "not_contacted", sourcedFor: "Senior Product Manager", createdAt: "2026-01-14" },
  { id: 5, firstName: "Siana", lastName: "Patel", title: "Talent Acquisition Lead", company: "Quickbase", email: "siana@quickbase.com", linkedinUrl: "https://linkedin.com/in/siana", verificationStatus: "valid", bucket: "recruiter", status: "interview_scheduled", sourcedFor: "Senior Product Manager", createdAt: "2026-01-14" },
  { id: 6, firstName: "Ekaterina", lastName: "Volkov", title: "Global People Ops Manager", company: "Quickbase", email: "ekaterina@quickbase.com", linkedinUrl: null, verificationStatus: "unknown", bucket: "recruiter", status: "not_contacted", sourcedFor: "Senior Product Manager", createdAt: "2026-01-14" },
  { id: 7, firstName: "Marcus", lastName: "Webb", title: "VP of Engineering", company: "Acme Corp", email: "marcus.webb@acmecorp.com", linkedinUrl: "https://linkedin.com/in/marcus", verificationStatus: "valid", bucket: "department_lead", status: "awaiting_reply", sourcedFor: "Staff Software Engineer", createdAt: "2026-02-01" },
  { id: 8, firstName: "Priya", lastName: "Sharma", title: "Technical Recruiter", company: "Acme Corp", email: "priya.sharma@acmecorp.com", linkedinUrl: "https://linkedin.com/in/priya", verificationStatus: "invalid", bucket: "recruiter", status: "not_contacted", sourcedFor: "Staff Software Engineer", createdAt: "2026-02-01" },
];

const VERIFICATION = {
  valid:   { label: "Verified",   dot: "#10b981" },
  risky:   { label: "Risky",      dot: "#f59e0b" },
  invalid: { label: "Invalid",    dot: "#ef4444" },
  unknown: { label: "Unverified", dot: "#9ca3af" },
};

const STATUS = {
  not_contacted:       { label: "Not Contacted",      color: "#6b7280", bg: "#f3f4f6" },
  email_sent:          { label: "Emailed",             color: "#2563eb", bg: "#eff6ff" },
  awaiting_reply:      { label: "Awaiting Reply",      color: "#d97706", bg: "#fffbeb" },
  follow_up_needed:    { label: "Follow Up",           color: "#ea580c", bg: "#fff7ed" },
  interview_scheduled: { label: "Interview",           color: "#059669", bg: "#ecfdf5" },
  rejected:            { label: "Rejected",            color: "#dc2626", bg: "#fef2f2" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .contacts-root {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    max-width: 1120px;
    margin: 0 auto;
    padding: 32px 24px;
    color: #1e1e2d;
    background: #fafbfc;
    min-height: 100vh;
  }

  /* Header */
  .contacts-header { margin-bottom: 20px; }
  .contacts-header h1 { font-size: 21px; font-weight: 700; color: #1e1e2d; }
  .contacts-header p { font-size: 13px; color: #7c8495; margin-top: 4px; }
  .contacts-header p span.sep { color: #d1d5db; margin: 0 6px; }

  /* Toolbar */
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

  /* Filter pills */
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

  /* Table */
  .contacts-table-wrap {
    background: #fff;
    border: 1px solid #e8eaed;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead th {
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

  tbody tr {
    border-bottom: 1px solid #f4f4f7;
    transition: background-color 0.1s;
    cursor: pointer;
  }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: #fafafd; }

  tbody td {
    padding: 12px 16px;
    font-size: 13px;
    color: #4b5563;
    vertical-align: middle;
    white-space: nowrap;
  }

  /* Name cell */
  .name-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .avatar {
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
  .avatar.recruiter { background: #f3f0ff; color: #7c3aed; }
  .avatar.hiring { background: #ecfeff; color: #0891b2; }
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

  /* Email cell */
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

  /* Status badge */
  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  /* Type badge */
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

  /* Actions cell */
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
    background: #f8fafc;
    color: #64748b;
    border: 1px solid #e2e8f0;
  }
  .gen-btn.secondary:hover { background: #f1f5f9; }

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
`;

export default function ContactsTable() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");

  const contacts = CONTACTS;

  const stats = {
    total: contacts.length,
    verified: contacts.filter(c => c.verificationStatus === "valid").length,
    needsOutreach: contacts.filter(c => c.status === "not_contacted").length,
    recruiters: contacts.filter(c => c.bucket === "recruiter").length,
    hiring: contacts.filter(c => c.bucket === "department_lead").length,
  };

  const filters = [
    { key: "all", label: "All", count: stats.total },
    { key: "needs_outreach", label: "Needs Outreach", count: stats.needsOutreach },
    { key: "recruiters", label: "Recruiters", count: stats.recruiters },
    { key: "hiring", label: "Hiring Managers", count: stats.hiring },
    { key: "verified", label: "Verified", count: stats.verified },
  ];

  const filtered = contacts.filter(c => {
    if (filter === "recruiters" && c.bucket !== "recruiter") return false;
    if (filter === "hiring" && c.bucket !== "department_lead") return false;
    if (filter === "verified" && c.verificationStatus !== "valid") return false;
    if (filter === "needs_outreach" && c.status !== "not_contacted") return false;
    if (search) {
      const q = search.toLowerCase();
      return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
        || c.company.toLowerCase().includes(q)
        || c.title.toLowerCase().includes(q)
        || c.email.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "recent") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === "company") return a.company.localeCompare(b.company);
    if (sort === "name") return a.lastName.localeCompare(b.lastName);
    return 0;
  });

  return (
    <div className="contacts-root">
      <style>{css}</style>

      <div className="contacts-header">
        <h1>Contacts</h1>
        <p>
          {stats.total} total
          <span className="sep">·</span>
          {stats.verified} verified
          <span className="sep">·</span>
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
              const v = VERIFICATION[c.verificationStatus] || VERIFICATION.unknown;
              const s = STATUS[c.status] || STATUS.not_contacted;
              const initials = `${c.firstName[0]}${c.lastName[0]}`;
              const isRecruiter = c.bucket === "recruiter";

              return (
                <tr key={c.id} onClick={() => console.log("view", c.id)}>
                  {/* NAME */}
                  <td>
                    <div className="name-cell">
                      <div className={`avatar ${isRecruiter ? "recruiter" : "hiring"}`}>
                        {initials}
                      </div>
                      <div className="name-text">
                        <div className="full-name">{c.firstName} {c.lastName}</div>
                        <div className="role-title" title={c.title}>{c.title}</div>
                      </div>
                    </div>
                  </td>

                  {/* COMPANY */}
                  <td style={{ fontWeight: 500, color: "#1e1e2d" }}>{c.company}</td>

                  {/* EMAIL */}
                  <td>
                    <div className="email-cell">
                      <span className="email-text">{c.email}</span>
                      <span className="dot-badge">
                        <span className="dot" style={{ backgroundColor: v.dot }} />
                        <span style={{ color: v.dot }}>{v.label}</span>
                      </span>
                    </div>
                  </td>

                  {/* TYPE */}
                  <td>
                    <span className={`type-badge ${isRecruiter ? "recruiter" : "hiring"}`}>
                      {isRecruiter ? "Recruiter" : "Hiring Mgr"}
                    </span>
                  </td>

                  {/* STATUS */}
                  <td>
                    <span className="status-badge" style={{ color: s.color, backgroundColor: s.bg }}>
                      {s.label}
                    </span>
                  </td>

                  {/* SOURCED FOR */}
                  <td>
                    <div className="sourced-label">
                      <span className="job-link" onClick={e => { e.stopPropagation(); console.log("go to job"); }} title={c.sourcedFor}>
                        {c.sourcedFor}
                      </span>
                    </div>
                  </td>

                  {/* ACTIONS */}
                  <td onClick={e => e.stopPropagation()}>
                    <div className="actions-cell">
                      {c.linkedinUrl && (
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="icon-btn linkedin" title="LinkedIn">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        </a>
                      )}
                      <button className="gen-btn primary" title="Generate outreach">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Draft
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

      <div className="table-footer">
        Showing {sorted.length} of {stats.total} contacts
      </div>
    </div>
  );
}
