import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Briefcase, Search as SearchIcon, Link, FileText, Globe, PlayCircle, BookOpen, Loader2, Lock, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";

export default function Search() {
  const [, setLocation] = useLocation();
  const [jobInput, setJobInput] = useState("");
  // URL input capability hidden - now always defaults to description
  const [activeTab, setActiveTab] = useState("description");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInputLocked, setIsInputLocked] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const submitJobMutation = useMutation({
    mutationFn: async (data: { input: string; runId: string }) => {
      const isUrl = data.input.trim().startsWith('http');
      return await apiRequest("POST", "/api/submissions", { 
        jobInput: data.input,
        inputType: isUrl ? "url" : "text",
        runId: data.runId
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      // Unlock input on success
      setIsInputLocked(false);
      setCurrentRunId(null);
      
      toast({
        title: "Job Submission Created",
        description: "Your job has been submitted for processing. Redirecting to results...",
      });
      setTimeout(() => {
        setLocation(`/submissions/${data.submission.id}`);
      }, 1000);
    },
    onError: (error: any) => {
      // Unlock input on error
      setIsInputLocked(false);
      setCurrentRunId(null);
      
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit job. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handleSubmit = () => {
    if (!jobInput.trim() || jobInput.trim().length < 12) {
      toast({
        title: "Input Required",
        description: "Please enter at least 12 characters to continue.",
        variant: "destructive",
      });
      return;
    }

    // Generate unique run ID and lock input immediately
    const runId = nanoid();
    setCurrentRunId(runId);
    setIsInputLocked(true);
    setIsProcessing(true);
    
    submitJobMutation.mutate({ input: jobInput.trim(), runId });
  };

  // Check if input meets minimum length requirement
  const hasMinimumInput = jobInput.trim().length >= 12;

  const handleCancel = () => {
    // Cancel current run and unlock input
    setIsInputLocked(false);
    setIsProcessing(false);
    setCurrentRunId(null);
    
    toast({
      title: "Analysis Cancelled",
      description: "Job analysis has been stopped. You can make edits and try again.",
    });
  };

  // Handle keyboard events to prevent input when locked
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isInputLocked) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isInputLocked) {
      e.preventDefault();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 text-center mb-8 pb-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <div className="relative">
            <SearchIcon className="h-6 w-6 text-blue-600" />
            <Users className="h-4 w-4 text-blue-600 absolute -bottom-1 -right-1" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Recruiter Contacts</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Paste a description and we'll pull the role details, find recruiter/hiring manager contacts, verify emails, and draft personalized outreach.
        </p>
      </div>

      {/* Input Section with Tabs */}
      <Card className="mb-8 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-0">
          {/* URL input capability hidden - can be restored with 're-install the url input capabilities' */}
          <Tabs value="description" onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-1 rounded-none rounded-t-lg">
              {/* <TabsTrigger value="url" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Job URL
              </TabsTrigger> */}
              <TabsTrigger value="description" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Job Description
              </TabsTrigger>
            </TabsList>
            
            {/* URL tab hidden - code preserved for restoration
            <TabsContent value="url" className="p-6 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Job URL</h3>
                <Input
                  value={jobInput}
                  onChange={(e) => setJobInput(e.target.value)}
                  placeholder="Paste the job listing URL (Greenhouse, Lever, etc.)"
                  className="text-sm"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Supported platforms: LinkedIn, Greenhouse, Lever, Indeed, and more
                </p>
              </div>
              
              <Button 
                onClick={handleSubmit} 
                disabled={isProcessing || !jobInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                <SearchIcon className="h-4 w-4 mr-2" />
                {isProcessing ? "Analyzing..." : "Analyze Job & Find Recruiters"}
              </Button>
            </TabsContent>
            */}
            
            <TabsContent value="description" className="p-6 space-y-4">
              <div>
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    id="jobDescription"
                    value={jobInput}
                    onChange={(e) => !isInputLocked && setJobInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder=" "
                    disabled={isInputLocked}
                    data-testid="textarea-job-description"
                    style={{ lineHeight: '1.6', minHeight: '19.2rem' }} // 12 lines * 1.6 line-height
                    className={`peer w-full text-sm resize-none transition-all duration-200 px-4 py-4 rounded-xl border placeholder-transparent focus:placeholder-transparent outline-none focus:ring-4 focus:ring-blue-200/50 ${
                      isInputLocked 
                        ? "text-gray-500 border-gray-300 cursor-not-allowed bg-gray-50" 
                        : "text-gray-900 border-gray-300 bg-white focus:border-blue-600"
                    }`}
                    aria-describedby="jd-help"
                  />
                  
                  {/* Floating label */}
                  <label
                    htmlFor="jobDescription"
                    className="pointer-events-none absolute left-4 top-4 px-1 bg-white text-gray-500 transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:-top-3 peer-focus:text-xs peer-focus:text-blue-600 peer-[&:not(:placeholder-shown)]:-top-3 peer-[&:not(:placeholder-shown)]:text-xs peer-[&:not(:placeholder-shown)]:text-gray-600"
                  >
                    Paste Full Job Description
                  </label>
                  
                  {/* Character counter */}
                  <div className={`absolute bottom-2 right-2 text-xs text-gray-400 bg-white/80 rounded px-1 ${
                    isInputLocked ? 'bottom-12' : 'bottom-2'
                  }`}>
                    {jobInput.length} characters
                  </div>
                  
                  {/* Lock overlay */}
                  {isInputLocked && (
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-md px-2 py-1 flex items-center gap-1.5 text-xs text-gray-600 shadow-sm">
                      <Lock className="h-3 w-3" />
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Locked — Analysis in progress</span>
                    </div>
                  )}
                </div>
                
                <p id="jd-help" className="text-sm text-gray-500 mt-2">
                  Tip: Include title, company, requirements, and responsibilities for best results.
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={handleSubmit} 
                  disabled={isProcessing || !hasMinimumInput || isInputLocked}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  size="lg"
                  data-testid="button-submit"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <div className="relative mr-2">
                        <SearchIcon className="h-4 w-4" />
                        <Users className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5" />
                      </div>
                      Find Contacts & Draft Outreach
                    </>
                  )}
                </Button>
                
                {/* Cancel button shown when processing */}
                {isProcessing && (
                  <Button 
                    onClick={handleCancel}
                    variant="outline"
                    size="lg"
                    className="px-4"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                )}
              </div>
              
              {!hasMinimumInput && !isProcessing && (
                <p className="text-sm text-gray-400 text-center mt-2">
                  Enter at least 12 characters to continue
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* How it Works Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">?</span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">New to JobConnect?</h3>
              <p className="text-gray-700 mb-4">
                Here's how it works: <strong>Paste a job URL or description, and we'll find the right recruiters to contact.</strong>
                {" "}You'll get personalized outreach messages tailored to the job.
              </p>
              <div className="flex gap-4">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Watch tutorial
                </Button>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Read the guide
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {isProcessing && (
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <div>
                <h4 className="font-medium text-blue-900">Processing Your Job Submission</h4>
                <p className="text-sm text-blue-700">
                  We're analyzing the job and finding the best recruiter contacts for you...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}