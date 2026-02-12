import { Search, Filter, ChevronDown, MapPin, Users, Calendar, Plus, Building2, Archive, Clock, ArrowRight, CheckCircle, Loader2, Mail, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface JobHistoryProps {
  onNavigate: (page: string, data?: any) => void;
}

interface JobSubmissionWithRecruiters {
  id: number;
  jobTitle: string | null;
  companyName: string | null;
  jobInput: string;
  status: string;
  notes: string | null;
  isArchived: string;
  submittedAt: string;
  recruiters: Array<{
    id: number;
    name: string | null;
    email: string | null;
    verificationStatus: string;
    contactStatus: string | null;
  }>;
}

const JOB_STATUSES = [
  { value: "saved", label: "Saved", color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
  { value: "applied", label: "Applied", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { value: "reaching_out", label: "Reaching Out", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { value: "in_conversation", label: "In Conversation", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { value: "interviewing", label: "Interviewing", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  { value: "closed", label: "Closed", color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb" },
];

const LEGACY_STATUS_MAP: Record<string, string> = {
  "not_contacted": "saved",
  "email_sent": "reaching_out",
  "awaiting_reply": "reaching_out",
  "follow_up_needed": "reaching_out",
  "interview_scheduled": "interviewing",
  "rejected": "closed",
};

function normalizeStatus(raw: string | null | undefined): string {
  const s = raw || "saved";
  return LEGACY_STATUS_MAP[s] || (JOB_STATUSES.some(js => js.value === s) ? s : "saved");
}

function getStatusConfig(value: string) {
  return JOB_STATUSES.find(s => s.value === value) || JOB_STATUSES[0];
}

export function JobHistory({ onNavigate }: JobHistoryProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<number | null>(null);

  const { data: submissions = [], isLoading } = useQuery<JobSubmissionWithRecruiters[]>({
    queryKey: ["/api/submissions"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PATCH", `/api/submissions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      setOpenStatusDropdown(null);
    },
  });

  const jobs = submissions.map((sub) => {
    const validContacts = sub.recruiters.filter(
      (r) => r.verificationStatus === "valid"
    ).length;

    const emailedCount = sub.recruiters.filter(
      (r) => r.contactStatus && r.contactStatus !== "not_contacted"
    ).length;

    const repliedCount = sub.recruiters.filter(
      (r) => r.contactStatus && ["replied", "interview_scheduled"].includes(r.contactStatus)
    ).length;

    const normalizedStatus = normalizeStatus(sub.status);

    return {
      id: sub.id,
      title: sub.jobTitle || "Unknown Position",
      company: sub.companyName || "Unknown Company",
      location: "Remote",
      status: normalizedStatus,
      contactsFound: sub.recruiters.length,
      contactsValid: validContacts,
      emailedCount,
      repliedCount,
      date: (() => {
        try {
          const d = new Date(sub.submittedAt);
          return !isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown";
        } catch { return "Unknown"; }
      })(),
      daysAgo: (() => {
        try {
          const d = new Date(sub.submittedAt);
          return !isNaN(d.getTime()) ? formatDistanceToNow(d, { addSuffix: true }) : "Unknown";
        } catch { return "Unknown"; }
      })(),
      notes: sub.notes || "",
      archived: sub.isArchived === "true",
    };
  });

  const filteredJobs = jobs.filter((job) => {
    const matchesFilter = activeFilter === "all" || job.status === activeFilter;
    const matchesSearch = 
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArchived = showArchived || !job.archived;
    return matchesFilter && matchesSearch && matchesArchived;
  });

  const totalJobs = filteredJobs.length;
  const totalContacts = filteredJobs.reduce((sum, job) => sum + job.contactsFound, 0);
  const validContacts = filteredJobs.reduce((sum, job) => sum + job.contactsValid, 0);

  const handleStatusChange = (jobId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: jobId, status: newStatus });
  };

  const filterPills = [
    { value: "all", label: "All Jobs" },
    ...JOB_STATUSES.map(s => ({ value: s.value, label: s.label })),
  ];

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#6B46C1] animate-spin mx-auto mb-4" />
          <p className="text-[#718096]">Loading job history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <h1 className="text-[#1A202C]">Job History</h1>
          <button
            onClick={() => onNavigate("search")}
            className="px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors flex items-center gap-2 w-fit"
            data-testid="button-new-search"
          >
            <Plus className="w-4 h-4" />
            New Search
          </button>
        </div>
        <p className="text-[#718096]">Track all your job applications and recruiter outreach</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#6B46C1]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1A202C]" data-testid="stat-total-jobs">{totalJobs}</div>
              <div className="text-sm text-[#718096]">Active Searches</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E2E8F0] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#4299E1]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1A202C]" data-testid="stat-total-contacts">{totalContacts}</div>
              <div className="text-sm text-[#718096]">Total Contacts</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E2E8F0] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[#48BB78]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1A202C]" data-testid="stat-verified-emails">{validContacts}</div>
              <div className="text-sm text-[#718096]">Verified Emails</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A0AEC0]" />
          <input
            type="text"
            placeholder="Search by job title or company..."
            className="w-full h-12 pl-10 pr-4 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-[#718096]">Status:</span>
          {filterPills.map(pill => (
            <button
              key={pill.value}
              onClick={() => setActiveFilter(pill.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === pill.value
                  ? "bg-[#6B46C1] text-white"
                  : "bg-white border border-[#E2E8F0] text-[#718096] hover:border-[#6B46C1]"
              }`}
              data-testid={`filter-${pill.value}`}
            >
              {pill.label}
            </button>
          ))}
          
          <div className="flex-1"></div>
          
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              showArchived
                ? "bg-[#6B46C1] text-white"
                : "bg-white border border-[#E2E8F0] text-[#718096] hover:border-[#6B46C1]"
            }`}
            data-testid="toggle-archived"
          >
            <Archive className="w-4 h-4" />
            Archived
          </button>

          <div className="text-sm text-[#718096]">
            {filteredJobs.length} jobs
          </div>
        </div>
      </div>

      {/* Job Cards */}
      <div className="space-y-3">
        {filteredJobs.map((job) => {
          const cfg = getStatusConfig(job.status);
          return (
            <div
              key={job.id}
              className="group bg-white rounded-lg border border-[#E2E8F0] p-5 hover:border-[#6B46C1] hover:shadow-sm transition-all"
              data-testid={`job-card-${job.id}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-2">
                    <div>
                      <h3 className="text-[#1A202C] font-medium mb-1">{job.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#718096] flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {job.company}
                        </span>
                        <span>·</span>
                        <span>{job.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-[#718096] mt-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {job.contactsFound} Contacts
                    </span>
                    <span>·</span>
                    <span>{job.contactsValid} Verified</span>
                    {job.emailedCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-[#d97706]">
                          <Mail className="w-3.5 h-3.5" />
                          {job.emailedCount} Emailed
                        </span>
                      </>
                    )}
                    {job.repliedCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-[#059669]">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {job.repliedCount} Replied
                        </span>
                      </>
                    )}
                  </div>

                  {job.notes && (
                    <div className="mt-2 text-sm text-[#718096] bg-[#F9FAFB] px-3 py-2 rounded border border-[#E2E8F0]">
                      {job.notes}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                  <div className="relative">
                    <button
                      onClick={() => setOpenStatusDropdown(openStatusDropdown === job.id ? null : job.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border w-fit hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                      data-testid={`status-dropdown-${job.id}`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }}></span>
                      {cfg.label}
                      <ChevronDown className="w-3.5 h-3.5 ml-1" />
                    </button>

                    {openStatusDropdown === job.id && (
                      <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 z-10 min-w-[180px]">
                        {JOB_STATUSES.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => handleStatusChange(job.id, s.value)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] transition-colors flex items-center gap-2 ${
                              job.status === s.value ? "bg-purple-50" : ""
                            }`}
                            data-testid={`status-option-${s.value}`}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#A0AEC0] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {job.daysAgo}
                    </span>
                    <button 
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#A0AEC0] hover:text-[#718096] p-1"
                      title="Archive"
                      data-testid={`button-archive-${job.id}`}
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onNavigate("job-details", { submissionId: job.id })}
                      className="px-3 py-1.5 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors text-sm font-medium flex items-center gap-1"
                      data-testid={`button-view-details-${job.id}`}
                    >
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredJobs.length === 0 && (
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-12 text-center">
          <div className="w-16 h-16 bg-[#F9FAFB] rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-[#A0AEC0]" />
          </div>
          <h3 className="text-[#1A202C] mb-2">No jobs found</h3>
          <p className="text-[#718096] mb-6">
            {searchQuery ? "Try adjusting your search" : "Start a new search to find recruiter contacts"}
          </p>
          <button
            onClick={() => onNavigate("search")}
            className="px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors inline-flex items-center gap-2"
            data-testid="button-new-search-empty"
          >
            <Plus className="w-4 h-4" />
            New Search
          </button>
        </div>
      )}
    </div>
  );
}
