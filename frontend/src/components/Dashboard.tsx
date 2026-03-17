import { Search, Users, MessageSquare, ArrowRight, TrendingUp, Zap, CheckCircle, Loader2, Sparkles, BarChart3, Mail, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface DashboardProps {
  onNavigate: (page: string, data?: any) => void;
}

interface JobSubmissionWithRecruiters {
  id: number;
  jobTitle: string | null;
  companyName: string | null;
  submittedAt: string;
  recruiters: Array<{
    id: number;
    verificationStatus: string;
  }>;
}

interface Contact {
  id: number;
  verificationStatus: string;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { data: submissions = [], isLoading: loadingSubmissions } = useQuery<JobSubmissionWithRecruiters[]>({
    queryKey: ["/api/submissions"],
  });

  const { data: allContacts = [], isLoading: loadingContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/all"],
  });

  const isLoading = loadingSubmissions || loadingContacts;

  const recentSearches = submissions.slice(0, 5).map((sub) => ({
    id: sub.id,
    jobTitle: sub.jobTitle || "Unknown Position",
    company: sub.companyName || "Unknown Company",
    date: new Date(sub.submittedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }),
    contactsFound: sub.recruiters.length,
    contactsValid: sub.recruiters.filter(r => r.verificationStatus === "valid").length,
  }));

  const totalContacts = allContacts.length;
  const verifiedEmails = allContacts.filter(c => c.verificationStatus === "valid").length;
  const verificationRate = totalContacts > 0 ? Math.round((verifiedEmails / totalContacts) * 100) : 0;

  const totalJobs = submissions.length;

  const LEGACY_STATUS_MAP: Record<string, string> = {
    "not_contacted": "saved",
    "email_sent": "reaching_out",
    "awaiting_reply": "reaching_out",
    "follow_up_needed": "reaching_out",
    "interview_scheduled": "interviewing",
    "rejected": "closed",
  };
  const normalizeStatus = (raw: string) => LEGACY_STATUS_MAP[raw] || raw;

  const statusCounts = submissions.reduce(
    (acc, sub) => {
      const status = normalizeStatus((sub as any).status || "saved");
      if (status === "saved") acc.saved++;
      else if (status === "applied") acc.applied++;
      else if (status === "reaching_out") acc.reachingOut++;
      else if (status === "in_conversation") acc.inConversation++;
      else if (status === "interviewing") acc.interviewing++;
      else if (status === "closed") acc.closed++;
      else acc.saved++;
      return acc;
    },
    { saved: 0, applied: 0, reachingOut: 0, inConversation: 0, interviewing: 0, closed: 0 }
  );

  const activeStatuses = [
    { label: "Saved", count: statusCounts.saved, color: "#94a3b8", bg: "#f1f5f9" },
    { label: "Applied", count: statusCounts.applied, color: "#3b82f6", bg: "#eff6ff" },
    { label: "Reaching out", count: statusCounts.reachingOut, color: "#f59e0b", bg: "#fffbeb" },
    { label: "In conversation", count: statusCounts.inConversation, color: "#8b5cf6", bg: "#f5f3ff" },
    { label: "Interviewing", count: statusCounts.interviewing, color: "#10b981", bg: "#ecfdf5" },
    { label: "Closed", count: statusCounts.closed, color: "#64748b", bg: "#f8fafc" },
  ];

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 bg-[#F5F3FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-6 h-6 text-[#6B46C1] animate-spin" />
          </div>
          <p className="text-[#64748B] text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-[1200px]">
      {/* Welcome + CTA Section */}
      <div className="mb-8">
        <div className="bg-gradient-to-br from-[#6B46C1] via-[#7C3AED] to-[#8B5CF6] rounded-2xl p-8 md:p-10 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/[0.04] rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-white/[0.03] rounded-full translate-y-1/2" />
          <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-white/[0.02] rounded-full" />

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-white text-2xl md:text-3xl font-bold mb-2 tracking-tight">Welcome back</h1>
                <p className="text-white/80 text-[15px] max-w-lg leading-relaxed">
                  Skip the application black hole. Find and contact hiring managers directly with AI-powered outreach.
                </p>
              </div>
              <button
                onClick={() => onNavigate("search")}
                className="bg-white text-[#6B46C1] px-7 py-3.5 rounded-xl hover:bg-white/95 transition-all font-semibold shadow-lg shadow-black/10 flex items-center gap-2.5 justify-center md:justify-start whitespace-nowrap text-[15px] hover:shadow-xl hover:shadow-black/15 active:scale-[0.98]"
                data-testid="button-start-new-search"
              >
                <Search className="w-[18px] h-[18px]" />
                Start New Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid — 3 equal cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

        {/* Total Contacts */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 hover:shadow-lg hover:shadow-[#6B46C1]/[0.04] transition-all duration-200 group">
          <div className="flex items-center justify-between mb-5">
            <div className="w-11 h-11 bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5 text-[#3B82F6]" />
            </div>
            {totalContacts > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold">
                <TrendingUp className="w-3 h-3" />
                {verificationRate}% verified
              </span>
            )}
          </div>
          <div className="mb-4">
            <div className="text-3xl font-extrabold text-[#0F172A] tracking-tight" data-testid="stat-total-contacts">{totalContacts}</div>
            <div className="text-sm text-[#64748B] mt-1">Total contacts found</div>
          </div>
          <div className="pt-4 border-t border-[#F1F5F9]">
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="text-[#94A3B8] font-medium">Verified emails</span>
              <span className="text-[#0F172A] font-bold tabular-nums" data-testid="stat-verified-emails">{verifiedEmails}</span>
            </div>
            <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(verificationRate, totalContacts > 0 ? 2 : 0)}%`,
                  background: verificationRate > 0 ? "linear-gradient(90deg, #10B981, #059669)" : "#E2E8F0"
                }}
              />
            </div>
          </div>
        </div>

        {/* AI Messages */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 hover:shadow-lg hover:shadow-[#6B46C1]/[0.04] transition-all duration-200 group">
          <div className="flex items-center justify-between mb-5">
            <div className="w-11 h-11 bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-[#7C3AED]" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-3xl font-extrabold text-[#0F172A] tracking-tight">—</div>
            <div className="text-sm text-[#64748B] mt-1">AI messages generated</div>
          </div>
          <div className="pt-4 border-t border-[#F1F5F9]">
            <button
              onClick={() => onNavigate("contacts")}
              className="text-xs text-[#7C3AED] font-semibold hover:text-[#6D28D9] transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              Generate outreach from contacts
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Active Applications */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 hover:shadow-lg hover:shadow-[#6B46C1]/[0.04] transition-all duration-200 group">
          <div className="flex items-center justify-between mb-5">
            <div className="w-11 h-11 bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <Target className="w-5 h-5 text-[#059669]" />
            </div>
          </div>
          <div className="mb-4">
            <div className="text-3xl font-extrabold text-[#0F172A] tracking-tight" data-testid="stat-total-jobs">{totalJobs}</div>
            <div className="text-sm text-[#64748B] mt-1">Active job applications</div>
          </div>
          <div className="pt-4 border-t border-[#F1F5F9]">
            <div className="grid grid-cols-3 gap-2">
              {activeStatuses.filter(s => s.count > 0 || ["Saved", "Applied", "Reaching out"].includes(s.label)).slice(0, 3).map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-lg font-bold text-[#0F172A] tabular-nums">{s.count}</div>
                  <div className="text-[10px] text-[#94A3B8] font-medium truncate">{s.label}</div>
                </div>
              ))}
            </div>
            {totalJobs > 0 && (
              <button
                onClick={() => onNavigate("job-history")}
                className="mt-3 text-xs text-[#7C3AED] font-semibold hover:text-[#6D28D9] transition-colors flex items-center gap-1.5"
              >
                View all applications
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Overview — only show if there are jobs */}
      {totalJobs > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-[#94A3B8]" />
              <h3 className="text-sm font-semibold text-[#0F172A]">Application Pipeline</h3>
            </div>
            <span className="text-xs text-[#94A3B8] font-medium">{totalJobs} total</span>
          </div>
          <div className="flex gap-1.5 h-2.5 rounded-full overflow-hidden bg-[#F1F5F9] mb-4">
            {activeStatuses.filter(s => s.count > 0).map((s) => (
              <div
                key={s.label}
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(s.count / totalJobs) * 100}%`,
                  backgroundColor: s.color,
                  minWidth: s.count > 0 ? "8px" : "0",
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {activeStatuses.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-[#64748B]">{s.label}</span>
                <span className="font-bold text-[#0F172A] tabular-nums">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="text-[#0F172A] font-semibold text-base mb-0.5">Recent Searches</h2>
            <p className="text-[#94A3B8] text-sm">Your most recent job searches</p>
          </div>
          {recentSearches.length > 0 && (
            <button
              onClick={() => onNavigate("job-history")}
              className="text-[#6B46C1] hover:text-[#5a3ba1] flex items-center gap-1.5 text-sm font-semibold transition-colors hover:gap-2.5"
              data-testid="link-view-all"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Table - Desktop */}
        {recentSearches.length > 0 && (
          <div className="hidden md:block border-t border-[#E2E8F0]">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFBFC]">
                  <th className="text-left text-[#94A3B8] font-semibold text-[11px] uppercase tracking-wider py-3 px-6">
                    Position
                  </th>
                  <th className="text-left text-[#94A3B8] font-semibold text-[11px] uppercase tracking-wider py-3 px-6">
                    Company
                  </th>
                  <th className="text-left text-[#94A3B8] font-semibold text-[11px] uppercase tracking-wider py-3 px-6">
                    Date
                  </th>
                  <th className="text-left text-[#94A3B8] font-semibold text-[11px] uppercase tracking-wider py-3 px-6">
                    Contacts
                  </th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {recentSearches.map((search, index) => (
                  <tr
                    key={search.id}
                    onClick={() => onNavigate("job-details", { submissionId: search.id })}
                    className={`hover:bg-[#FAFBFC] cursor-pointer transition-colors group ${
                      index !== recentSearches.length - 1 ? 'border-b border-[#F1F5F9]' : ''
                    }`}
                    data-testid={`recent-search-${search.id}`}
                  >
                    <td className="py-4 px-6">
                      <div className="font-semibold text-[#0F172A] text-[14px] leading-snug">{search.jobTitle}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-[#64748B] text-sm font-medium">{search.company}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-[#94A3B8] text-sm tabular-nums">{search.date}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F1F5F9] rounded-md text-xs font-semibold text-[#64748B]">
                          {search.contactsFound} found
                        </span>
                        {search.contactsValid > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded-md text-xs font-semibold text-emerald-700">
                            <CheckCircle className="w-3 h-3" />
                            {search.contactsValid} verified
                          </span>
                        ) : (
                          <span className="text-xs text-[#CBD5E1]">0 verified</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <ArrowRight className="w-4 h-4 text-[#E2E8F0] group-hover:text-[#6B46C1] group-hover:translate-x-0.5 transition-all" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cards - Mobile */}
        {recentSearches.length > 0 && (
          <div className="md:hidden divide-y divide-[#F1F5F9] border-t border-[#E2E8F0]">
            {recentSearches.map((search) => (
              <div
                key={search.id}
                onClick={() => onNavigate("job-details", { submissionId: search.id })}
                className="p-4 hover:bg-[#FAFBFC] cursor-pointer transition-colors active:bg-[#F1F5F9] group"
                data-testid={`recent-search-mobile-${search.id}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#0F172A] text-[14px] mb-0.5 truncate">{search.jobTitle}</h3>
                    <p className="text-[#64748B] text-sm font-medium">{search.company}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#E2E8F0] group-hover:text-[#6B46C1] flex-shrink-0 ml-3 mt-0.5" />
                </div>
                <div className="flex items-center gap-3 text-xs mt-2">
                  <span className="text-[#94A3B8]">{search.date}</span>
                  <span className="w-1 h-1 rounded-full bg-[#E2E8F0]" />
                  <span className="text-[#64748B] font-medium">{search.contactsFound} found</span>
                  {search.contactsValid > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-[#E2E8F0]" />
                      <span className="text-emerald-600 font-semibold">{search.contactsValid} verified</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {recentSearches.length === 0 && (
          <div className="p-16 text-center border-t border-[#E2E8F0]">
            <div className="w-16 h-16 bg-[#F5F3FF] rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Search className="w-7 h-7 text-[#C4B5FD]" />
            </div>
            <h3 className="text-[#0F172A] font-semibold text-lg mb-2">No searches yet</h3>
            <p className="text-[#94A3B8] mb-6 max-w-sm mx-auto text-sm leading-relaxed">
              Paste a job description and let our AI find the right recruiters and hiring managers to contact
            </p>
            <button
              onClick={() => onNavigate("search")}
              className="px-6 py-2.5 bg-[#6B46C1] text-white rounded-xl hover:bg-[#5a3ba1] transition-all inline-flex items-center gap-2 font-semibold text-sm shadow-sm hover:shadow-md active:scale-[0.98]"
              data-testid="button-start-search-empty"
            >
              <Search className="w-4 h-4" />
              Start Your First Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
