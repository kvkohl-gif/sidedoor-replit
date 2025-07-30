import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  FileText, 
  Link as LinkIcon, 
  Zap,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const [jobInput, setJobInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const submitJobMutation = useMutation({
    mutationFn: async (input: string) => {
      return await apiRequest("/api/submissions", "POST", { jobInput: input });
    },
    onSuccess: (data) => {
      toast({
        title: "Job Submission Created",
        description: "Your job has been submitted for processing. Redirecting to results...",
      });
      setTimeout(() => {
        setLocation(`/submissions/${data.id}`);
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit job. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handleSubmit = () => {
    if (!jobInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter a job description or URL to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    submitJobMutation.mutate(jobInput.trim());
  };

  const isUrl = jobInput.trim().startsWith('http');

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Search className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Recruiter Contacts</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Paste a job description or job posting URL to discover and connect with recruiters and hiring managers
        </p>
      </div>

      {/* Input Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isUrl ? (
              <>
                <LinkIcon className="h-5 w-5 text-blue-600" />
                Job Posting URL
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 text-blue-600" />
                Job Description
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={jobInput}
            onChange={(e) => setJobInput(e.target.value)}
            placeholder="Paste job description or job posting URL here...

Examples:
• https://jobs.company.com/posting/12345
• Job Title: Senior Software Engineer at TechCorp
  
We are looking for an experienced software engineer to join our team..."
            className="min-h-[200px] text-sm resize-none"
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{jobInput.length} characters</span>
              {isUrl && (
                <Badge variant="outline" className="text-xs">
                  <LinkIcon className="h-3 w-3 mr-1" />
                  URL Detected
                </Badge>
              )}
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={!jobInput.trim() || isProcessing}
              className="bg-green-600 hover:bg-green-700 text-white px-8"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Find Contacts
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="text-center">
          <CardContent className="p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">1. Submit Job Info</h3>
            <p className="text-sm text-gray-600">
              Paste a job description or URL from any job board
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <Search className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">2. AI Discovery</h3>
            <p className="text-sm text-gray-600">
              Our AI finds and verifies recruiter contacts using Apollo and other sources
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-4">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">3. Generate Outreach</h3>
            <p className="text-sm text-gray-600">
              Get personalized email and LinkedIn messages ready to send
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm font-medium text-blue-900">Analyzing job post...</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Finding contacts...</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Verifying emails...</span>
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-blue-700 mt-4">
              This usually takes 30-60 seconds. Please don't refresh the page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Tips for Best Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Include company name and job title</p>
              <p className="text-xs text-gray-600">This helps us find the most relevant recruiters</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Use recent job postings</p>
              <p className="text-xs text-gray-600">Active postings typically have more responsive contacts</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Supported job boards</p>
              <p className="text-xs text-gray-600">LinkedIn, Indeed, AngelList, company career pages, and most major job boards</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}