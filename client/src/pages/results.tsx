import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Copy, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { JobSubmissionWithRecruiters } from "@shared/schema";

export default function Results() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
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

  const { data: submission, isLoading: submissionLoading, error } = useQuery<JobSubmissionWithRecruiters>({
    queryKey: ["/api/submissions", id],
    enabled: isAuthenticated && !!id,
    retry: false,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleBackToDashboard = () => {
    setLocation("/dashboard");
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const copyEmail = async (email: string) => {
    await copyToClipboard(email, "Email address");
  };

  const getConfidenceBadge = (score: number | null) => {
    if (!score) return { variant: "secondary" as const, text: "Unknown" };
    if (score >= 90) return { variant: "default" as const, text: `${score}% confidence`, className: "bg-emerald-100 text-emerald-800" };
    if (score >= 75) return { variant: "default" as const, text: `${score}% confidence`, className: "bg-amber-100 text-amber-800" };
    return { variant: "secondary" as const, text: `${score}% confidence` };
  };

  const getVerificationBadge = (status: string | null, verified: string | null) => {
    if (verified === "true") {
      if (status === "valid") return { variant: "default" as const, text: "Verified", className: "bg-emerald-100 text-emerald-800" };
      if (status === "risky") return { variant: "default" as const, text: "Risky", className: "bg-amber-100 text-amber-800" };
    }
    if (status === "invalid") return { variant: "destructive" as const, text: "Invalid" };
    return { variant: "secondary" as const, text: "Unverified" };
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-slate-600">Loading submission...</p>
          </div>
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
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recruiters Column */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Recruiter Contacts</h2>
            
            {submission.recruiters && submission.recruiters.length > 0 ? (
              <div className="space-y-4">
                {submission.recruiters.map((recruiter) => {
                  const badge = getConfidenceBadge(recruiter.confidenceScore);
                  return (
                    <Card key={recruiter.id}>
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
                              <Badge 
                                variant={badge.variant}
                                className={badge.className}
                              >
                                {badge.text}
                              </Badge>
                            </div>
                            {recruiter.email && (
                              <div>
                                <Badge 
                                  variant={getVerificationBadge((recruiter as any).verificationStatus, (recruiter as any).emailVerified).variant}
                                  className={getVerificationBadge((recruiter as any).verificationStatus, (recruiter as any).emailVerified).className}
                                >
                                  {getVerificationBadge((recruiter as any).verificationStatus, (recruiter as any).emailVerified).text}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {recruiter.email && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Mail className="w-5 h-5 text-slate-400" />
                                <span className="text-slate-700">{recruiter.email}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyEmail(recruiter.email!)}
                                className="text-primary hover:text-blue-700"
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
                      </CardContent>
                    </Card>
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

          {/* Messages Column */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Generated Messages</h2>
            
            {/* Email Draft */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Email Draft</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(submission.emailDraft || "", "Email draft")}
                    className="text-primary hover:text-blue-700"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {submission.emailDraft || "No email draft available."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* LinkedIn Message */}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">LinkedIn Message</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(submission.linkedinMessage || "", "LinkedIn message")}
                    className="text-primary hover:text-blue-700"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {submission.linkedinMessage || "No LinkedIn message available."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
