import { Search, Sparkles, Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { nanoid } from "nanoid";

interface SearchPageProps {
  onNavigate: (page: string, data?: any) => void;
}

export function SearchPage({ onNavigate }: SearchPageProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [isInputLocked, setIsInputLocked] = useState(false);

  const sampleJobDescription = `Senior Product Manager - TechCorp Inc.
Location: San Francisco, CA (Hybrid)

We're seeking an experienced Senior Product Manager to lead our core product initiatives. You'll work closely with engineering, design, and business stakeholders to define and execute our product roadmap.

Key Responsibilities:
• Define product vision and strategy
• Lead cross-functional teams
• Conduct user research and market analysis
• Manage product roadmap and prioritization

Requirements:
• 5+ years product management experience
• B2B SaaS background
• Strong analytical skills
• Excellent communication
• MBA or technical degree preferred`;

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
      setIsInputLocked(false);
      onNavigate("job-details", { submissionId: data.submission.id });
    },
    onError: (error: any) => {
      setIsInputLocked(false);
      alert(error.message || "Failed to submit job. Please try again.");
    },
  });

  const handleSubmit = () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 12) {
      alert("Please enter at least 12 characters to continue.");
      return;
    }

    const runId = nanoid();
    setIsInputLocked(true);
    submitJobMutation.mutate({ input: jobDescription.trim(), runId });
  };

  const loadSampleData = () => {
    setJobDescription(sampleJobDescription);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 lg:p-8">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] rounded-2xl mb-4 relative">
            <Search className="w-8 h-8 text-white" />
            <Sparkles className="w-4 h-4 text-white absolute translate-x-4 -translate-y-4" />
          </div>
          <h1 className="text-[#1A202C] mb-2">Find Recruiter Contacts</h1>
          <p className="text-[#718096] max-w-2xl mx-auto">
            Paste a job description and we'll identify the role details, find recruiter contacts,
            verify emails, and draft personalized outreach messages.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden">
          {/* Input Section */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[#1A202C] font-medium">Job Description</label>
              <button
                onClick={loadSampleData}
                disabled={submitJobMutation.isPending || isInputLocked}
                className="flex items-center gap-1 text-sm text-[#6B46C1] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4" />
                Try sample
              </button>
            </div>
            
            <div className="relative">
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job posting here including title, company, location, responsibilities, and requirements..."
                disabled={isInputLocked || submitJobMutation.isPending}
                className="w-full h-64 p-4 border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent disabled:bg-[#F9FAFB] disabled:cursor-not-allowed text-[#1A202C] placeholder:text-[#A0AEC0]"
              />
            </div>

            {/* Helper Text */}
            {!submitJobMutation.isPending && (
              <p className="mt-3 text-sm text-[#718096]">
                <span className="font-medium">💡 Tip:</span> Include job title, company name, requirements, and
                responsibilities for best results.
              </p>
            )}

            {/* Processing Status */}
            {submitJobMutation.isPending && (
              <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-[#6B46C1] animate-spin" />
                  <span className="font-medium text-[#6B46C1]">
                    Processing job submission and finding contacts...
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!jobDescription.trim() || submitJobMutation.isPending || isInputLocked}
              className="w-full mt-6 bg-[#6B46C1] text-white py-3 px-6 rounded-lg hover:bg-[#5a3ba1] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#A0AEC0] disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {submitJobMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Find Contacts & Draft Outreach
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feature Highlights */}
        {!submitJobMutation.isPending && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-[#6B46C1] font-medium mb-1">AI-Powered</div>
              <div className="text-sm text-[#718096]">Smart job analysis</div>
            </div>
            <div className="text-center">
              <div className="text-[#6B46C1] font-medium mb-1">Verified Emails</div>
              <div className="text-sm text-[#718096]">Real-time validation</div>
            </div>
            <div className="text-center">
              <div className="text-[#6B46C1] font-medium mb-1">Ready to Send</div>
              <div className="text-sm text-[#718096]">Personalized messages</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}