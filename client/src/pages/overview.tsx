import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
        <div className="mb-8 border-2 border-dashed border-blue-200 hover:border-blue-300 transition-colors rounded-xl bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a new search</h3>
              <p className="text-gray-600 mb-4">
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
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Contacts Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Contacts</h3>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                12%
              </div>
            </div>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <p className="text-xs text-gray-500">contacts found</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span>Email verification</span>
                <span>{stats.emailVerificationRate}%</span>
              </div>
              <Progress value={stats.emailVerificationRate} className="h-2" />
            </div>
          </div>

          {/* Outreach Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Outreach</h3>
              <div className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">New</div>
            </div>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-gray-500">messages created</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span>Personalization score</span>
                <span>{stats.personalizationScore}%</span>
              </div>
              <Progress value={stats.personalizationScore} className="h-2" />
            </div>
          </div>

          {/* Activity Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Recent Activity</h3>
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{stats.recentSearches}</div>
            <p className="text-xs text-gray-500">searches this month</p>
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
          </div>
        </div>

        {/* Recent Searches */}
        <section className="mx-auto max-w-5xl">
          <div className="mb-3 flex items-end justify-between pt-2 pb-3">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">Recent Searches</h3>
              <p className="text-sm text-gray-500">Your 5 most recent job searches</p>
            </div>
            {submissions && submissions.length > 5 && (
              <a 
                href="/dashboard" 
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                data-testid="link-view-all-history"
              >
                View all job history <span>→</span>
              </a>
            )}
          </div>

          {recentSubmissions.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No recent searches yet</h3>
                <p className="text-gray-500 mb-4">Start your first job search to see results here</p>
                <Button onClick={handleNewSearch} data-testid="button-first-search">
                  <Plus className="h-4 w-4 mr-2" />
                  Start a new search
                </Button>
              </div>
            </div>
          ) : submissionsLoading ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 hidden lg:table-cell">Job Title</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Company</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Date</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Contacts</th>
                    <th className="px-2 py-3 hidden lg:table-cell"></th>
                    <th className="px-4 py-3 lg:hidden">Search</th>
                    <th className="px-2 py-3 lg:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="h-4 bg-gray-200 rounded animate-pulse mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                      <td className="px-2 py-3 hidden lg:table-cell">
                        <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                      <td className="px-4 py-4 lg:hidden">
                        <div className="h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                      <td className="px-2 py-3 lg:hidden">
                        <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 hidden lg:table-cell">Job Title</th>
                    <th scope="col" className="px-4 py-3 hidden lg:table-cell">Company</th>
                    <th scope="col" className="px-4 py-3 hidden lg:table-cell">Date</th>
                    <th scope="col" className="px-4 py-3 hidden lg:table-cell">Contacts</th>
                    <th scope="col" className="px-2 py-3 hidden lg:table-cell"></th>
                    <th scope="col" className="px-4 py-3 lg:hidden">Search</th>
                    <th scope="col" className="px-2 py-3 lg:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentSubmissions.slice(0, 5).map((submission) => {
                    const foundCount = submission.recruiters?.length || 0;
                    const verifiedCount = submission.recruiters?.filter(r => r.emailVerified).length || 0;
                    
                    return (
                      <tr key={submission.id} className="hover:bg-gray-50">
                        {/* Desktop Layout */}
                        <th scope="row" className="max-w-[280px] truncate px-4 py-4 text-sm font-medium text-gray-900 hidden lg:table-cell">
                          {submission.jobTitle || "Not specified"}
                        </th>
                        <td className="px-4 py-4 text-sm text-gray-600 hidden lg:table-cell">
                          {submission.companyName || "Unknown Company"}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500 hidden lg:table-cell">
                          {formatDate(submission.submittedAt)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="text-sm font-medium text-gray-900">{foundCount} found</div>
                          <div className="text-xs text-green-600">{verifiedCount} verified</div>
                        </td>
                        <td className="px-2 py-3 hidden lg:table-cell">
                          <a 
                            href={`/submissions/${submission.id}`}
                            className="inline-flex items-center rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label={`View results for ${submission.jobTitle || 'job'} at ${submission.companyName || 'company'}`}
                            data-testid={`link-submission-${submission.id}`}
                          >
                            →
                          </a>
                        </td>

                        {/* Mobile Layout */}
                        <td className="px-4 py-4 lg:hidden">
                          <div className="font-medium text-gray-900 truncate">
                            {submission.jobTitle || "Not specified"}
                          </div>
                          <div className="text-sm text-gray-600 truncate">
                            {submission.companyName || "Unknown Company"}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDate(submission.submittedAt)} • {foundCount}/{verifiedCount}
                          </div>
                        </td>
                        <td className="px-2 py-3 lg:hidden">
                          <a 
                            href={`/submissions/${submission.id}`}
                            className="inline-flex items-center rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label={`View results for ${submission.jobTitle || 'job'} at ${submission.companyName || 'company'}`}
                            data-testid={`link-submission-mobile-${submission.id}`}
                          >
                            →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}