import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, MessageSquare, BarChart3, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CompanySelectionModal, type ApolloOrganization } from "@/components/ui/company-selection-modal";
import { UserDropdown } from "@/components/ui/user-dropdown";

export default function Home() {
  const [inputType, setInputType] = useState<"text" | "url">("url");
  const [jobInput, setJobInput] = useState("");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autoSwitchMessage, setAutoSwitchMessage] = useState("");
  const [unsupportedUrlError, setUnsupportedUrlError] = useState("");
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Company search flow state
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [pendingJobContent, setPendingJobContent] = useState("");
  const [organizations, setOrganizations] = useState<ApolloOrganization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState<string>("");

  // Auto-focus when switching to text input after URL failure
  useEffect(() => {
    if (inputType === "text" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [inputType]);

  // Company search mutation
  const companySearchMutation = useMutation({
    mutationFn: async (jobContent: string) => {
      const response = await apiRequest("POST", "/api/company/search", { jobContent });
      return response.json();
    },
    onError: (error) => {
      toast({
        title: "Company Search Failed",
        description: error.message || "Failed to search for company information",
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { 
      jobInput: string; 
      inputType: string; 
      organizationId?: string;
      companyDomain?: string;
    }) => {
      // Generate a unique runId for this submission
      const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const response = await apiRequest("POST", "/api/submissions", { ...data, runId });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      setLocation(`/results/${data.id}`);
      
      // Reset modal state
      setShowCompanyModal(false);
      setPendingJobContent("");
      setOrganizations([]);
      setSelectedOrganizationId(null);
      setCustomDomain("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process job submission",
        variant: "destructive",
      });
    },
  });

  // Smart content detection
  const unsupportedDomains = ["linkedin.com", "wellfound.com"];
  
  const isValidUrl = (text: string): boolean => {
    try {
      const url = new URL(text);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isUnsupportedDomain = (text: string): boolean => {
    try {
      const url = new URL(text);
      return unsupportedDomains.some(domain => url.hostname.includes(domain));
    } catch {
      return false;
    }
  };

  const looksLikeJobDescription = (text: string): boolean => {
    const lowercaseText = text.toLowerCase();
    const jobDescriptorWords = [
      'responsibilities', 'requirements', 'qualifications', 'experience',
      'we are looking', 'job description', 'role summary', 'about the role',
      'what you\'ll do', 'who you are', 'benefits', 'salary', 'location'
    ];
    
    return jobDescriptorWords.some(word => lowercaseText.includes(word)) && 
           text.length > 100; // Job descriptions are typically longer
  };

  const handleInputChange = (value: string) => {
    setJobInput(value);
    setAutoSwitchMessage("");
    setUnsupportedUrlError("");
    setIsButtonDisabled(false);

    if (inputType === "url" && value.trim()) {
      // Check for unsupported domains first
      if (isValidUrl(value) && isUnsupportedDomain(value)) {
        setUnsupportedUrlError("This URL is not supported. Please paste the full job description instead.");
        setIsButtonDisabled(true);
        return;
      }

      // Smart auto-switching logic for job descriptions in URL field
      if (value.length > 50 && !isValidUrl(value) && looksLikeJobDescription(value)) {
        setAutoSwitchMessage("This looks like a full job description. Switching to the right input field…");
        setTimeout(() => {
          setInputType("text");
          setAutoSwitchMessage("");
        }, 1500);
      }
    }
  };

  const handleSubmit = async () => {
    if (!jobInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a job description or URL",
        variant: "destructive",
      });
      return;
    }

    // For URL submissions, try to validate and handle failures
    if (inputType === "url") {
      if (!isValidUrl(jobInput.trim())) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid URL (e.g., https://company.com/jobs/position)",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Step 1: Search for company information first
      setPendingJobContent(jobInput.trim());
      const companySearchResult = await companySearchMutation.mutateAsync(jobInput.trim());
      
      if (companySearchResult.organizations && companySearchResult.organizations.length > 0) {
        // Show company selection modal if multiple matches found
        setOrganizations(companySearchResult.organizations);
        setShowCompanyModal(true);
      } else {
        // No company matches found, proceed with standard submission
        await submitMutation.mutateAsync({ 
          jobInput: jobInput.trim(), 
          inputType 
        });
      }
    } catch (error: any) {
      // Handle URL parsing failures with auto-switch
      if (inputType === "url" && (
        error.message?.includes("fetch") || 
        error.message?.includes("parse") ||
        error.message?.includes("timeout") ||
        error.message?.includes("empty")
      )) {
        toast({
          title: "URL Parsing Failed",
          description: "We couldn't fetch the job details from that URL. Please paste the job description manually.",
          variant: "destructive",
        });
        setInputType("text");
        // Focus will be handled by useEffect below
        return;
      }
      
      // Re-throw other errors to be handled by mutation's onError
      throw error;
    }
  };

  const handleCompanyConfirm = async (organizationId: string | null, customDomain?: string) => {
    try {
      await submitMutation.mutateAsync({ 
        jobInput: pendingJobContent, 
        inputType,
        organizationId: organizationId || undefined,
        companyDomain: customDomain || undefined
      });
    } catch (error) {
      // Error will be handled by mutation's onError
    }
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const goToDashboard = () => {
    setLocation("/dashboard");
  };

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
                onDashboard={goToDashboard}
                showDashboard={true}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Find the right recruiter for any job instantly.
          </h1>
          <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
            Paste a job description or URL and get recruiter contacts with personalized outreach messages powered by AI.
          </p>
        </div>

        {/* Input Form */}
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-8">
            <div className="space-y-6">
              {/* Toggle Buttons */}
              <div className="flex bg-slate-100 p-1 rounded-lg w-fit mx-auto">
                <Button
                  variant={inputType === "url" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setInputType("url");
                    setAutoSwitchMessage("");
                    setUnsupportedUrlError("");
                    setIsButtonDisabled(false);
                  }}
                  className={inputType === "url" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}
                >
                  Job URL
                </Button>
                <Button
                  variant={inputType === "text" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setInputType("text");
                    setAutoSwitchMessage("");
                    setUnsupportedUrlError("");
                    setIsButtonDisabled(false);
                  }}
                  className={inputType === "text" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}
                >
                  Job Description
                </Button>
              </div>

              {/* Auto-switch message */}
              {autoSwitchMessage && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    {autoSwitchMessage}
                  </AlertDescription>
                </Alert>
              )}

              {/* Input Area with Loading State */}
              {submitMutation.isPending ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                  {/* Loading Spinner */}
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                  {/* Processing Text */}
                  <p className="text-sm text-slate-500 animate-pulse">
                    {inputType === "url" ? "Analyzing job URL..." : "Processing job description..."}
                  </p>
                </div>
              ) : (
                <>
                  {inputType === "url" ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Job URL
                      </label>
                      <Input
                        ref={inputRef}
                        type="url"
                        placeholder="Paste the job listing URL (e.g., Greenhouse, Lever, company career pages)"
                        value={jobInput}
                        onChange={(e) => handleInputChange(e.target.value)}
                        className={`text-base ${unsupportedUrlError ? 'border-red-300 focus:border-red-500' : ''}`}
                      />
                      {unsupportedUrlError ? (
                        <p className="text-sm text-red-600 mt-2">
                          {unsupportedUrlError}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">
                          We'll automatically fetch and analyze the job details from the URL
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Job Description
                      </label>
                      <Textarea
                        ref={textareaRef}
                        placeholder="Paste the full job description here..."
                        className="h-48 resize-none text-base"
                        value={jobInput}
                        onChange={(e) => handleInputChange(e.target.value)}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Include as much detail as possible for better recruiter matching
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Submit Button - Hidden during loading */}
              {!submitMutation.isPending && (
                <div className="text-center">
                  <div className="relative group">
                    <Button 
                      onClick={handleSubmit}
                      className="bg-primary text-white hover:bg-blue-700 px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      size="lg"
                      disabled={!jobInput.trim() || isButtonDisabled}
                    >
                      {inputType === "url" ? "Analyze Job & Find Recruiters" : "Find Recruiters & Generate Messages"}
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                      </svg>
                    </Button>
                    {isButtonDisabled && (
                      <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Unsupported link. Paste full job description instead.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>



        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">AI-Powered Search</h3>
            <p className="text-slate-600">Advanced AI extracts recruiter information and contact details from job postings.</p>
          </div>
          <div className="text-center">
            <div className="bg-emerald-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Personalized Messages</h3>
            <p className="text-slate-600">Get tailored email and LinkedIn messages for effective outreach.</p>
          </div>
          <div className="text-center">
            <div className="bg-amber-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Track History</h3>
            <p className="text-slate-600">Keep track of all your searches and generated messages in your dashboard.</p>
          </div>
        </div>
      </div>

      {/* Company Selection Modal */}
      <CompanySelectionModal
        isOpen={showCompanyModal}
        onClose={() => {
          setShowCompanyModal(false);
          setPendingJobContent("");
          setOrganizations([]);
        }}
        organizations={organizations}
        onConfirm={handleCompanyConfirm}
        isLoading={submitMutation.isPending}
      />
    </div>
  );
}
