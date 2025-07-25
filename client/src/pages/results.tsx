import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Mail, Copy, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { RecruiterMessageCard } from "@/components/ui/recruiter-message-card";
import { JobDetailCard } from "@/components/ui/job-detail-card";
import type { JobSubmissionWithRecruiters } from "@shared/schema";

export default function Results() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const submissionId = params.id;

  // State for UI interactions
  const [showSuggestions, setShowSuggestions] = useState<{[key: number]: boolean}>({});
  const [jobSummaryExpanded, setJobSummaryExpanded] = useState(true);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleBackToDashboard = () => {
    setLocation("/dashboard");
  };

  const toggleSuggestion = (contactId: number) => {
    setShowSuggestions(prev => ({
      ...prev,
      [contactId]: !prev[contactId]
    }));
  };

  // Fetch submission data
  const {
    data: submission,
    isLoading: submissionLoading,
    error,
  } = useQuery<JobSubmissionWithRecruiters>({
    queryKey: ["/api/submissions", submissionId],
    enabled: !!submissionId && isAuthenticated,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) return false;
      return failureCount < 3;
    },
  });

  // Fetch enhanced job data with standardized format
  const { data: enhancedJobData } = useQuery<{
    submissionId: number;
    enhancedData?: {
      job_title?: string;
      company_name?: string;
      job_url?: string;
      company_website?: string;
      location?: string;
      job_description?: string;
      key_responsibilities?: string[];
      requirements?: string[];
      likely_departments?: string[];
      linkedin_keywords?: string[];
    };
    hasEnhancedData: boolean;
  }>({
    queryKey: ["/api/submissions", submissionId, "job-data"],
    enabled: !!submissionId && !!submission && isAuthenticated,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) return false;
      return failureCount < 3;
    },
  });

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast({
        title: "Copied!",
        description: "Email address copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the text manually",
        variant: "destructive",
      });
    }
  };

  const getConfidenceBadge = (score: number | null) => {
    if (!score) return { 
      variant: "secondary" as const, 
      text: "Unknown", 
      tooltip: "This confidence score was sourced from Apollo. 'Unknown' means no data was returned for this contact.",
      className: "text-slate-400"
    };
    if (score >= 90) return { 
      variant: "default" as const, 
      text: `${score}% confidence`, 
      className: "bg-emerald-100 text-emerald-800",
      tooltip: "High confidence match based on job title analysis"
    };
    if (score >= 75) return { 
      variant: "default" as const, 
      text: `${score}% confidence`, 
      className: "bg-amber-100 text-amber-800",
      tooltip: "Good confidence match based on job title analysis"
    };
    return { 
      variant: "secondary" as const, 
      text: `${score}% confidence`,
      tooltip: "Moderate confidence match based on job title analysis"
    };
  };

  const getVerificationBadge = (status: string | null, verified: string | null) => {
    if (verified === "true") {
      if (status === "valid") return { 
        variant: "default" as const, 
        text: "✅ Verified", 
        className: "bg-emerald-100 text-emerald-800",
        tooltip: "Email confirmed deliverable via NeverBounce verification"
      };
      if (status === "risky") return { 
        variant: "default" as const, 
        text: "⚠️ Risky", 
        className: "bg-amber-100 text-amber-800",
        tooltip: "This is a catch-all domain. The server accepts all emails, but individual email validity could not be confirmed."
      };
    }
    if (status === "invalid") return { 
      variant: "destructive" as const, 
      text: "❌ Invalid",
      tooltip: "Email confirmed undeliverable via NeverBounce verification"
    };
    return { 
      variant: "secondary" as const, 
      text: "❓ Unverified",
      tooltip: "Email verification not attempted or failed"
    };
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (submissionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-slate-600 text-sm">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-xl font-bold text-slate-900">Recruiter Contact Finder</h1>
              <Button variant="ghost" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Submission Not Found</h2>
            <p className="text-slate-600 mb-6">The submission you're looking for doesn't exist or you don't have access to it.</p>
            <Button onClick={handleBackToDashboard} className="bg-primary text-white hover:bg-blue-700">
              Back to Dashboard
            </Button>
          </div>
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
            <h1 className="text-xl font-bold text-slate-900">Recruiter Contact Finder</h1>
            <Button variant="ghost" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={handleBackToDashboard}
            className="text-primary hover:text-blue-700 mb-4 p-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {submission.jobTitle || "Untitled Position"}
          </h1>
          <p className="text-slate-600">
            {submission.companyName || "Unknown Company"}
          </p>
          {enhancedJobData?.enhancedData?.location && (
            <p className="text-sm text-slate-500 mt-1">
              📍 {enhancedJobData?.enhancedData?.location}
            </p>
          )}
        </div>

        {/* Standardized Job Information Display */}
        {enhancedJobData?.hasEnhancedData && enhancedJobData.enhancedData && (
          <JobDetailCard 
            jobData={{
              job_title: enhancedJobData.enhancedData.job_title || "Not specified",
              company_name: enhancedJobData.enhancedData.company_name || "Not specified",
              job_url: enhancedJobData.enhancedData.job_url || (submission.inputType === "url" ? submission.jobInput : "Not specified"),
              company_website: enhancedJobData.enhancedData.company_website || "Not specified",
              location: enhancedJobData.enhancedData.location || "Not specified",
              job_description: enhancedJobData.enhancedData.job_description || "Not specified",
              key_responsibilities: enhancedJobData.enhancedData.key_responsibilities || ["Not specified"],
              requirements: enhancedJobData.enhancedData.requirements || ["Not specified"],
              likely_departments: enhancedJobData.enhancedData.likely_departments || ["Other"],
            }}
            className="mb-8"
          />
        )}

        {/* Fallback job info if no enhanced data */}
        {!enhancedJobData?.hasEnhancedData && (
          <Collapsible open={jobSummaryExpanded} onOpenChange={setJobSummaryExpanded} className="mb-8">
            <Card>
              <CardContent className="p-6">
                <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                  <h2 className="text-lg font-semibold text-slate-900">Job Information</h2>
                  {jobSummaryExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                  )}
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-4 space-y-4">
                  {/* Job URL - Display first */}
                  {submission?.inputType === "url" && (
                    <div>
                      <h3 className="font-medium text-slate-900 mb-2">Job URL</h3>
                      <a 
                        href={submission.jobInput} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:text-blue-700 break-all text-sm flex items-center"
                      >
                        {submission.jobInput}
                        <ExternalLink className="w-4 h-4 ml-2 flex-shrink-0" />
                      </a>
                    </div>
                  )}

                  {/* Job Description Summary - Display second */}
                  {submission?.inputType === "text" && (
                    <div>
                      <h3 className="font-medium text-slate-900 mb-2">Job Description</h3>
                      <p className="text-slate-700 text-sm leading-relaxed">
                        {submission.jobInput && submission.jobInput.length > 500 
                          ? `${submission.jobInput.substring(0, 500)}...`
                          : submission.jobInput
                        }
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </CardContent>
            </Card>
          </Collapsible>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left side: Contacts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recruiter contacts */}
            {submission.recruiters && submission.recruiters.length > 0 ? (
              <div className="space-y-4">
                {submission.recruiters.map((recruiter) => {
                  const confidenceBadge = getConfidenceBadge(recruiter.confidenceScore);
                  const verificationBadge = getVerificationBadge((recruiter as any).verificationStatus, (recruiter as any).emailVerified);
                  return (
                    <TooltipProvider key={recruiter.id}>
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900">
                                {recruiter.name || "Unknown Recruiter"}
                              </h3>
                              <p className="text-slate-600">
                                {recruiter.title || "Unknown Title"}
                              </p>
                            </div>
                            <div className="text-right space-y-2">
                              <div>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge 
                                      variant={confidenceBadge.variant}
                                      className={confidenceBadge.className}
                                    >
                                      {confidenceBadge.text}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm">
                                      <strong>Confidence Score</strong><br/>
                                      {confidenceBadge.tooltip}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              {recruiter.email && (
                                <div>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge 
                                        variant={verificationBadge.variant}
                                        className={verificationBadge.className}
                                      >
                                        {verificationBadge.text}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-sm">{verificationBadge.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            {recruiter.email && (
                              <div className="flex items-center space-x-3">
                                <Mail className="w-5 h-5 text-slate-400" />
                                <span className="text-slate-700">{recruiter.email}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyEmail(recruiter.email!)}
                                  className="text-primary hover:text-blue-700 p-1"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            )}

                            {!recruiter.email && recruiter.linkedinUrl && (
                              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                                No verified email found. Use LinkedIn to connect.
                              </div>
                            )}

                            {recruiter.linkedinUrl && (
                              <div className="flex items-center space-x-3">
                                <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                </svg>
                                <a
                                  href={recruiter.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-blue-700 flex items-center"
                                >
                                  LinkedIn Profile
                                  <ExternalLink className="w-4 h-4 ml-1" />
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Per-Recruiter Message Generation */}
                          <div className="mt-4 pt-4 border-t">
                            <RecruiterMessageCard recruiter={recruiter} />
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipProvider>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-slate-600">No recruiter contacts were found for this submission.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right sidebar: Actions and Notes */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button 
                    onClick={handleBackToDashboard} 
                    variant="outline" 
                    className="w-full"
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
