import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Filter, Archive, Clock, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import { StatusDropdown, type StatusType } from "@/components/ui/status-dropdown";
import { InlineNotes } from "@/components/ui/inline-notes";
import { UserDropdown } from "@/components/ui/user-dropdown";
import { apiRequest } from "@/lib/queryClient";
import type { JobSubmissionWithRecruiters } from "@shared/schema";

type SortOption = "newest" | "oldest" | "status" | "company" | "recruiters";
type FilterStatus = "all" | "contacted" | "not_contacted" | StatusType;

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showArchived, setShowArchived] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: submissions, isLoading: submissionsLoading } = useQuery<JobSubmissionWithRecruiters[]>({
    queryKey: ["/api/submissions"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Mutations for updating job data
  const updateJobMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/submissions/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job",
        variant: "destructive",
      });
    },
  });

  // Filter and sort submissions
  const filteredAndSortedSubmissions = useMemo(() => {
    if (!submissions) return [];

    let filtered = submissions.filter(submission => {
      // Archive filter
      const isArchived = submission.isArchived === "true";
      if (showArchived !== isArchived) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = `${submission.jobTitle || ""} ${submission.companyName || ""}`.toLowerCase();
        if (!searchableText.includes(query)) return false;
      }

      // Status filter
      if (filterStatus !== "all") {
        if (filterStatus === "contacted") {
          return submission.status !== "not_contacted";
        } else if (filterStatus === "not_contacted") {
          return submission.status === "not_contacted" || !submission.status;
        } else {
          return submission.status === filterStatus;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
        case "oldest":
          return new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime();
        case "company":
          return (a.companyName || "").localeCompare(b.companyName || "");
        case "status":
          return (a.status || "not_contacted").localeCompare(b.status || "not_contacted");
        case "recruiters":
          return (b.recruiters?.length || 0) - (a.recruiters?.length || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [submissions, searchQuery, filterStatus, sortBy, showArchived]);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleNewSearch = () => {
    setLocation("/");
  };

  const handleViewResults = (submissionId: number) => {
    setLocation(`/submissions/${submissionId}`);
  };

  const handleStatusChange = (submissionId: number, newStatus: StatusType) => {
    updateJobMutation.mutate({
      id: submissionId,
      updates: {
        status: newStatus,
        lastContactedAt: newStatus !== "not_contacted" ? new Date().toISOString() : null
      }
    });
  };

  const handleNotesUpdate = (submissionId: number, notes: string) => {
    updateJobMutation.mutate({
      id: submissionId,
      updates: { notes }
    });
  };

  const handleArchive = (submissionId: number) => {
    updateJobMutation.mutate({
      id: submissionId,
      updates: { isArchived: "true" }
    });
  };

  const handleSnooze = (submissionId: number) => {
    // For now, just archive - can enhance with date picker later
    handleArchive(submissionId);
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "1 week ago";
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingAnimation 
          type="default" 
          message="Loading your dashboard..." 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600">Your recruiter search history</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={() => setShowArchived(!showArchived)}
              className={showArchived ? "bg-slate-100" : ""}
            >
              <Archive className="w-4 h-4 mr-2" />
              {showArchived ? "Show Active" : "Show Archived"}
            </Button>
            <Button onClick={handleNewSearch} className="bg-primary text-white hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" />
              New Search
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="not_contacted">Not Contacted</SelectItem>
                  <SelectItem value="email_sent">Email Sent</SelectItem>
                  <SelectItem value="awaiting_reply">Awaiting Reply</SelectItem>
                  <SelectItem value="follow_up_needed">Follow-Up Needed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest → Oldest</SelectItem>
                  <SelectItem value="oldest">Oldest → Newest</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="company">Company Name</SelectItem>
                  <SelectItem value="recruiters">Recruiters Found</SelectItem>
                </SelectContent>
              </Select>

              {/* Results Count */}
              <div className="flex items-center text-sm text-slate-600">
                <Filter className="w-4 h-4 mr-2" />
                {filteredAndSortedSubmissions.length} result{filteredAndSortedSubmissions.length !== 1 ? 's' : ''}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {submissionsLoading && (
          <div className="py-8">
            <LoadingAnimation 
              type="search" 
              message="Loading your submission history..." 
            />
          </div>
        )}

        {/* Job Submissions */}
        {!submissionsLoading && filteredAndSortedSubmissions.length > 0 && (
          <div className="grid gap-6">
            {filteredAndSortedSubmissions.map((submission) => (
              <Card key={submission.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        {submission.jobTitle || "Untitled Position"}
                      </h3>
                      <p className="text-slate-600 mb-3">
                        {submission.companyName || "Unknown Company"}
                      </p>
                      
                      {/* Status and metadata */}
                      <div className="flex items-center space-x-4 mb-3">
                        <StatusDropdown
                          status={(submission.status as StatusType) || "not_contacted"}
                          onStatusChange={(newStatus) => handleStatusChange(submission.id, newStatus)}
                        />
                        <span className="text-sm text-slate-500">
                          {submission.recruiters?.length || 0} recruiter{(submission.recruiters?.length || 0) !== 1 ? 's' : ''} found
                        </span>
                      </div>

                      {/* Last action metadata */}
                      {submission.lastContactedAt && submission.lastContactedRecruiter && (
                        <p className="text-sm text-slate-500 mb-3">
                          Last contact: {submission.lastContactedRecruiter} on {formatDate(submission.lastContactedAt)}
                        </p>
                      )}

                      {/* Date */}
                      <div className="flex items-center space-x-4 text-sm text-slate-500 mb-4">
                        <span>{formatDate(submission.submittedAt)}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSnooze(submission.id)}
                        className="text-slate-600 hover:text-slate-800"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(submission.id)}
                        className="text-slate-600 hover:text-slate-800"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewResults(submission.id)}
                        className="text-primary hover:text-blue-700"
                      >
                        View Results
                      </Button>
                    </div>
                  </div>

                  {/* Inline Notes */}
                  <div className="border-t pt-4">
                    <InlineNotes
                      notes={submission.notes || ""}
                      onSave={(notes) => handleNotesUpdate(submission.id, notes)}
                      placeholder="Add job-specific notes..."
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!submissionsLoading && filteredAndSortedSubmissions.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            {submissions && submissions.length === 0 ? (
              <>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No searches yet</h3>
                <p className="text-slate-600 mb-6">Start by searching for recruiters using a job description or URL.</p>
                <Button onClick={handleNewSearch} className="bg-primary text-white hover:bg-blue-700">
                  Start First Search
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No results found</h3>
                <p className="text-slate-600 mb-6">Try adjusting your filters or search terms.</p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                    setSortBy("newest");
                  }}
                >
                  Clear Filters
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
