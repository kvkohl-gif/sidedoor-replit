import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

import { 
  Search, 
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
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, {(user as any)?.firstName || (user as any)?.email?.split('@')[0] || 'User'}
          </h1>
          <p className="text-slate-600">Here's what's happening with your recruiter outreach</p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-8">
          {/* Start a new search */}
          <section 
            role="region" 
            aria-labelledby="card-new" 
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3">
              <h3 id="card-new" className="text-sm font-medium text-gray-700">Start a new search</h3>
              <p className="mt-1 text-xs text-gray-500">Paste a job description to find recruiters and hiring managers</p>
            </div>
            <button 
              onClick={handleNewSearch}
              className="flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-[#0070BA] text-white text-sm font-semibold hover:bg-[#005C99] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 w-full"
              data-testid="button-new-search"
            >
              <Search className="h-4 w-4" />
              Find Contacts
            </button>
          </section>

          {/* Contacts */}
          <section 
            role="region" 
            aria-labelledby="card-contacts" 
            className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="absolute right-3 top-3 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">
              <TrendingUp className="inline h-3 w-3 mr-0.5" />
              12%
            </div>
            <h3 id="card-contacts" className="text-sm font-medium text-gray-700">Contacts</h3>
            <div className="mt-2 flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">{stats.totalContacts}</div>
              <div className="ml-2 text-xs text-gray-500">contacts found</div>
            </div>
            <div className="mt-4 text-xs text-gray-600">Email verification</div>
            <div 
              className="mt-1 h-1.5 w-full rounded-full bg-gray-100" 
              role="progressbar" 
              aria-valuemin={0} 
              aria-valuemax={100} 
              aria-valuenow={stats.emailVerificationRate}
            >
              <div 
                className="h-1.5 rounded-full bg-emerald-500 transition-all duration-300" 
                style={{ width: `${stats.emailVerificationRate}%` }} 
              />
            </div>
            <div className="mt-1 text-right text-xs text-gray-500">{stats.emailVerificationRate}%</div>
          </section>

          {/* Outreach */}
          <section 
            role="region" 
            aria-labelledby="card-outreach" 
            className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="absolute right-3 top-3 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">New</div>
            <h3 id="card-outreach" className="text-sm font-medium text-gray-700">Outreach</h3>
            <div className="mt-2 flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">{stats.totalMessages}</div>
              <div className="ml-2 text-xs text-gray-500">messages created</div>
            </div>
            <div className="mt-4 text-xs text-gray-600">Personalization score</div>
            <div 
              className="mt-1 h-1.5 w-full rounded-full bg-gray-100" 
              role="progressbar" 
              aria-valuemin={0} 
              aria-valuemax={100} 
              aria-valuenow={stats.personalizationScore}
            >
              <div 
                className="h-1.5 rounded-full bg-blue-600 transition-all duration-300" 
                style={{ width: `${stats.personalizationScore}%` }} 
              />
            </div>
            <div className="mt-1 text-right text-xs text-gray-500">{stats.personalizationScore}%</div>
          </section>
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
                    <th className="px-4 py-3 hidden lg:table-cell text-left">Job Title</th>
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
                    <th scope="col" className="px-4 py-3 hidden lg:table-cell text-left">Job Title</th>
                    <th scope="col" className="px-4 py-3 hidden lg:table-cell">Company</th>
                    <th scope="col" className="px-4 py-3 hidden lg:table-cell">Date</th>
                    <th scope="col" className="px-4 py-3 hidden lg:table-cell">Contacts</th>
                    <th scope="col" className="px-2 py-3 hidden lg:table-cell"></th>
                    <th scope="col" className="px-4 py-3 lg:hidden text-left">Search</th>
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
                        <th scope="row" className="max-w-[280px] truncate px-4 py-4 text-sm font-medium text-gray-900 hidden lg:table-cell text-left">
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
                        <td className="px-4 py-4 lg:hidden text-left">
                          <div className="font-medium text-gray-900 truncate text-left">
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