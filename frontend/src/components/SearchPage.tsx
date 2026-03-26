import { Search, Sparkles, Loader2, Zap, CheckCircle2, FileText, Building2, Users, Mail, MessageSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { nanoid } from "nanoid";

interface SearchPageProps {
  onNavigate: (page: string, data?: any) => void;
}

const LOADING_STEPS = [
  { icon: FileText, label: "Analyzing job posting...", detail: "Extracting role, company, and requirements", delay: 0 },
  { icon: Building2, label: "Identifying company...", detail: "Finding company domain and org details", delay: 3000 },
  { icon: Search, label: "Mapping target departments...", detail: "Using AI to determine who owns this role", delay: 6000 },
  { icon: Users, label: "Searching for contacts...", detail: "Finding recruiters and hiring managers", delay: 10000 },
  { icon: Mail, label: "Verifying emails...", detail: "Validating email addresses in real-time", delay: 16000 },
  { icon: MessageSquare, label: "Drafting outreach messages...", detail: "Creating personalized emails and LinkedIn notes", delay: 22000 },
];

export function SearchPage({ onNavigate }: SearchPageProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [isInputLocked, setIsInputLocked] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const stepTimersRef = useRef<NodeJS.Timeout[]>([]);
  const queryClient = useQueryClient();

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

  // Advance loading steps on timers
  useEffect(() => {
    if (!isInputLocked) {
      // Clean up timers and reset
      stepTimersRef.current.forEach(t => clearTimeout(t));
      stepTimersRef.current = [];
      setActiveStep(0);
      return;
    }

    // Start step progression
    LOADING_STEPS.forEach((step, i) => {
      if (i === 0) return; // Step 0 is immediate
      const timer = setTimeout(() => setActiveStep(i), step.delay);
      stepTimersRef.current.push(timer);
    });

    return () => {
      stepTimersRef.current.forEach(t => clearTimeout(t));
      stepTimersRef.current = [];
    };
  }, [isInputLocked]);

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
      // Refresh credits in sidebar after successful search
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      onNavigate("job-details", { submissionId: data.submission.id });
    },
    onError: (error: any) => {
      setIsInputLocked(false);
      // Parse credit-related errors for user-friendly messages
      const msg = error.message || "";
      try {
        const statusMatch = msg.match(/^(\d+):\s*(.*)/s);
        if (statusMatch) {
          const status = parseInt(statusMatch[1]);
          const body = JSON.parse(statusMatch[2]);
          if (status === 402 || status === 403) {
            if (body.error === "trial_expired") {
              alert("Your free trial has expired. Upgrade your plan to continue searching.");
            } else if (body.error === "insufficient_credits") {
              alert(`You don't have enough credits. This action requires ${body.creditsNeeded} credits but you have ${body.creditsRemaining}.`);
            } else {
              alert(body.message || "Unable to process this search.");
            }
            onNavigate("billing");
            return;
          }
        }
      } catch {}
      alert(msg || "Failed to submit job. Please try again.");
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

            {/* Processing Status — step-by-step */}
            {submitJobMutation.isPending && (
              <div className="mt-6 space-y-2">
                {LOADING_STEPS.map((step, i) => {
                  const StepIcon = step.icon;
                  const isActive = i === activeStep;
                  const isDone = i < activeStep;
                  const isPending = i > activeStep;

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                        isActive
                          ? "bg-purple-50 border border-purple-200"
                          : isDone
                          ? "bg-green-50 border border-green-100"
                          : "bg-[#F9FAFB] border border-transparent opacity-40"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : isActive ? (
                          <Loader2 className="w-5 h-5 text-[#6B46C1] animate-spin" />
                        ) : (
                          <StepIcon className="w-5 h-5 text-[#A0AEC0]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${
                          isActive ? "text-[#6B46C1]" : isDone ? "text-green-700" : "text-[#A0AEC0]"
                        }`}>
                          {isDone ? step.label.replace("...", "") + " ✓" : step.label}
                        </div>
                        {isActive && (
                          <div className="text-xs text-[#718096] mt-0.5">{step.detail}</div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <p className="text-xs text-center text-[#A0AEC0] mt-3">
                  This usually takes 30–60 seconds
                </p>
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