import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  ArrowRight,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { UserDropdown } from "@/components/ui/user-dropdown";
import type { JobSubmissionWithRecruiters } from "@shared/schema";

interface DashboardStats {
  totalContacts: number;
  verifiedContacts: number;
  totalMessages: number;
  recentSearches: number;
  emailVerificationRate: number;
  personalizationScore: number;
}

export default function Overview() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

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

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleNewSearch = () => {
    setLocation("/search");
  };

  const handleViewAllHistory = () => {
    setLocation("/dashboard");
  };

  const handleViewSubmission = (id: number) => {
    setLocation(`/submissions/${id}`);
  };

  // Calculate dashboard statistics
  const calculateStats = (submissions: JobSubmissionWithRecruiters[]): DashboardStats => {
    if (!submissions || submissions.length === 0) {
      return {
        totalContacts: 0,
        verifiedContacts: 0,
        totalMessages: 0,
        recentSearches: 0,
        emailVerificationRate: 0,
        personalizationScore: 0,
      };
    }

    const totalContacts = submissions.reduce((sum, sub) => sum + (sub.recruiters?.length || 0), 0);
    const verifiedContacts = submissions.reduce((sum, sub) => 
      sum + (sub.recruiters?.filter(r => r.emailVerified).length || 0), 0);
    
    const totalMessages = submissions.reduce((sum, sub) => 
      sum + (sub.recruiters?.filter(r => r.emailDraft && r.emailDraft.trim().length > 0).length || 0), 0);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentSearches = submissions.filter(sub => 
      sub.submittedAt && new Date(sub.submittedAt) >= thirtyDaysAgo).length;

    const emailVerificationRate = totalContacts > 0 ? Math.round((verifiedContacts / totalContacts) * 100) : 0;
    const personalizationScore = totalContacts > 0 ? Math.round((totalMessages / totalContacts) * 100) : 0;

    return {
      totalContacts,
      verifiedContacts,
      totalMessages,
      recentSearches,
      emailVerificationRate,
      personalizationScore,
    };
  };

  const stats = submissions ? calculateStats(submissions) : {
    totalContacts: 0,
    verifiedContacts: 0,
    totalMessages: 0,
    recentSearches: 0,
    emailVerificationRate: 0,
    personalizationScore: 0,
  };

  // Get recent submissions (last 5)
  const recentSubmissions = submissions 
    ? [...submissions]
        .sort((a, b) => {
          const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5)
    : [];

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays < 7) return `${diffDays - 1} days ago`;
    if (diffDays < 14) return "1 week ago";
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (submission: JobSubmissionWithRecruiters) => {
    const recruiters = submission.recruiters || [];
    const verifiedCount = recruiters.filter(r => r.emailVerified).length;
    const totalCount = recruiters.length;

    if (totalCount === 0) {
      return <Badge variant="secondary">Pending</Badge>;
    }
    if (verifiedCount === totalCount) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Complete</Badge>;
    }
    if (verifiedCount > 0) {
      return <Badge variant="default" className="bg-blue-100 text-blue-800">Partial</Badge>;
    }
    return <Badge variant="destructive">Issues</Badge>;
  };

  if (isLoading || submissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-slate-900">Recruiter Contact Finder</h1>
            </div>
            <div className="flex items-center">
              <UserDropdown 
                user={user}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, {(user as any)?.firstName || (user as any)?.email?.split('@')[0] || 'User'}
          </h1>
          <p className="text-slate-600">Here's what's happening with your recruiter outreach</p>
        </div>

        {/* Quick Action */}
        <Card className="mb-8 border-2 border-dashed border-blue-200 hover:border-blue-300 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Start a new search</h3>
                <p className="text-slate-600 mb-4">
                  Paste a job description to find recruiters and hiring managers
                </p>
              </div>
              <Button 
                onClick={handleNewSearch}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-new-search"
              >
                <Plus className="h-4 w-4 mr-2" />
                Find Contacts
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Contacts Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contacts</CardTitle>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                12%
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
              <p className="text-xs text-muted-foreground">contacts found</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Email verification</span>
                  <span>{stats.emailVerificationRate}%</span>
                </div>
                <Progress value={stats.emailVerificationRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Outreach Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outreach</CardTitle>
              <Badge variant="secondary" className="text-xs">New</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMessages}</div>
              <p className="text-xs text-muted-foreground">messages created</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Personalization score</span>
                  <span>{stats.personalizationScore}%</span>
                </div>
                <Progress value={stats.personalizationScore} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Activity Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentSearches}</div>
              <p className="text-xs text-muted-foreground">searches this month</p>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Success rate</span>
                  <span>{stats.totalContacts > 0 ? Math.round((stats.verifiedContacts / stats.totalContacts) * 100) : 0}%</span>
                </div>
                <Progress 
                  value={stats.totalContacts > 0 ? (stats.verifiedContacts / stats.totalContacts) * 100 : 0} 
                  className="h-2" 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Searches */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Searches</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Your {recentSubmissions.length} most recent job searches
                </p>
              </div>
              {submissions && submissions.length > 5 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleViewAllHistory}
                  data-testid="button-view-all-history"
                >
                  View all job history
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentSubmissions.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No searches yet</h3>
                <p className="text-slate-500 mb-4">Start your first job search to see results here</p>
                <Button onClick={handleNewSearch} data-testid="button-first-search">
                  <Plus className="h-4 w-4 mr-2" />
                  Start Your First Search
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Table Header */}
                <div className="hidden md:grid md:grid-cols-5 gap-4 text-xs font-medium text-slate-500 uppercase tracking-wide pb-2 border-b">
                  <div>Job Title</div>
                  <div>Company</div>
                  <div>Date</div>
                  <div>Contacts</div>
                  <div>Status</div>
                </div>

                {/* Table Rows */}
                {recentSubmissions.map((submission) => (
                  <div 
                    key={submission.id}
                    className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => handleViewSubmission(submission.id)}
                    data-testid={`submission-row-${submission.id}`}
                  >
                    <div className="md:col-span-1">
                      <div className="font-medium text-slate-900 truncate">
                        {submission.jobTitle || "Untitled Position"}
                      </div>
                      <div className="md:hidden text-sm text-slate-500 mt-1">
                        {submission.companyName || "Unknown Company"}
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <div className="text-slate-700">
                        {submission.companyName || "Unknown Company"}
                      </div>
                    </div>
                    <div className="md:col-span-1">
                      <div className="text-sm text-slate-500">
                        {formatDate(submission.submittedAt)}
                      </div>
                    </div>
                    <div className="md:col-span-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {submission.recruiters?.length || 0} found
                        </span>
                        <span className="text-sm text-green-600">
                          {submission.recruiters?.filter(r => r.emailVerified).length || 0} verified
                        </span>
                      </div>
                    </div>
                    <div className="md:col-span-1 flex items-center justify-between">
                      {getStatusBadge(submission)}
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}