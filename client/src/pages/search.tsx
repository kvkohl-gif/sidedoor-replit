import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Briefcase, Search as SearchIcon, Link, FileText, Globe, PlayCircle, BookOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Search() {
  const [, setLocation] = useLocation();
  const [jobInput, setJobInput] = useState("");
  const [activeTab, setActiveTab] = useState("url");
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <SearchIcon className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Recruiter Contacts</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Paste a job description or job posting URL to discover and connect with recruiters and hiring managers
        </p>
      </div>

      {/* Input Section with Tabs */}
      <Card className="mb-8">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none rounded-t-lg">
              <TabsTrigger value="url" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Job URL
              </TabsTrigger>
              <TabsTrigger value="description" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Job Description
              </TabsTrigger>
            </TabsList>
            
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
            
            <TabsContent value="description" className="p-6 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Job Description</h3>
                <Textarea
                  value={jobInput}
                  onChange={(e) => setJobInput(e.target.value)}
                  placeholder="Paste the complete job description here..."
                  className="min-h-[200px] text-sm resize-none"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Include job title, company name, requirements, and responsibilities for best results
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