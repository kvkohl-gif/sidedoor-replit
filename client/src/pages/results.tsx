import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { JobDetailCard } from "@/components/ui/job-detail-card";
import { UserDropdown } from "@/components/ui/user-dropdown";
import ContactCards from "@/components/ui/contact-cards";
import type { JobSubmissionWithRecruiters } from "@shared/schema";

export default function Results() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const submissionId = params.id;

  // State for UI interactions
  const [jobSummaryExpanded, setJobSummaryExpanded] = useState(true);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleBackToDashboard = () => {
    setLocation("/dashboard");
  };

  // Fetch submission data
  const {
    data: submission,
    isLoading: submissionLoading,
    error,
  } = useQuery<JobSubmissionWithRecruiters>({
    queryKey: [`/api/submissions/${submissionId}`],
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
    queryKey: [`/api/submissions/${submissionId}/job-data`],
    enabled: !!submissionId && isAuthenticated,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) return false;
      return failureCount < 3;
    },
  });

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

  if (isLoading || submissionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading submission details...</p>
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
              <UserDropdown 
                user={user}
                onLogout={handleLogout}
                onDashboard={handleBackToDashboard}
                showDashboard={true}
              />
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
            <UserDropdown 
              user={user}
              onLogout={handleLogout}
              onDashboard={handleBackToDashboard}
              showDashboard={true}
            />
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

        {/* Enhanced Job Information Display */}
        {enhancedJobData?.hasEnhancedData && enhancedJobData.enhancedData ? (
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
        ) : (
          /* Fallback job info if no enhanced data */
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

        {/* Contact Cards */}
        {submission.recruiters && submission.recruiters.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Recruiter Contacts</h2>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {submission.recruiters.length} contacts found
              </Badge>
            </div>
            <ContactCards 
              contacts={submission.recruiters.map(r => ({
                id: r.id,
                name: r.name || "Unknown",
                title: r.title || "Unknown Title",
                email: r.email || "",
                linkedinUrl: r.linkedinUrl || undefined,
                confidence: r.confidenceScore || 0,
                department: (r as any).outreachBucket === "recruiter" ? "Recruiting" : 
                           (r as any).department || "Other",
                emailVerified: (r as any).emailVerified || false,
                verificationStatus: (r as any).verificationStatus || "unknown",
                sourcePlatform: r.sourcePlatform || "openai",
                apolloId: (r as any).apolloId,
                isRecruiterRole: (r as any).outreachBucket === "recruiter" || 
                               (r.title?.toLowerCase().includes("recruiter") || false),
                contactStatus: (r as any).contactStatus,
                notes: (r as any).notes,
                lastContacted: (r as any).lastContacted,
                influenceScore: (r as any).influenceScore,
                emailDraft: (r as any).emailDraft,
                linkedinMessage: (r as any).linkedinMessage,
              }))}
              submissionId={parseInt(submissionId || "0")}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Contacts Found</h3>
            <p className="text-slate-600 mb-4">
              We couldn't find any recruiter contacts for this position yet.
            </p>
            <Button
              onClick={() => setLocation("/")}
              className="bg-primary text-white hover:bg-blue-700"
            >
              Try Another Search
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}