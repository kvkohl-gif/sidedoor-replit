import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, User, X, Sparkles } from "lucide-react";
import { useOnboarding } from "../hooks/useOnboarding";

interface OnboardingWizardProps {
  onNavigate: (page: string) => void;
}

export default function OnboardingWizard({ onNavigate }: OnboardingWizardProps) {
  const [dismissed, setDismissed] = useState(false);
  const { isComplete, isLoading: onboardingLoading } = useOnboarding();

  const { data: submissions, isLoading: submissionsLoading } = useQuery<any[]>({
    queryKey: ["/api/submissions"],
  });

  const isLoading = onboardingLoading || submissionsLoading;
  const hasSubmissions = submissions && submissions.length > 0;

  // Don't show if loading, dismissed, onboarding complete, or user has submissions
  if (isLoading || dismissed || isComplete || hasSubmissions) {
    return null;
  }

  const steps = [
    {
      icon: <Search className="w-6 h-6" />,
      title: "Search for a job",
      description: "Paste a job URL or describe a role you're targeting",
    },
    {
      icon: <User className="w-6 h-6" />,
      title: "Find the right contacts",
      description: "We'll find recruiters and hiring managers at the company",
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Reach out with AI",
      description: "Generate personalized messages to start a conversation",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Purple gradient header */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 px-8 pt-8 pb-10 text-white">
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-4 right-4 p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Welcome to SideDoor</h1>
          <p className="mt-2 text-purple-100 text-sm">
            Find the right people and land your next opportunity in 3 simple steps.
          </p>
        </div>

        {/* Steps */}
        <div className="px-8 -mt-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-4 p-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-600 shrink-0">
                  {step.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    <span className="text-purple-600 mr-1">{i + 1}.</span>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 pt-6 pb-8 flex flex-col items-center gap-3">
          <button
            onClick={() => {
              setDismissed(true);
              onNavigate("search");
            }}
            className="w-full py-3 px-6 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition-colors shadow-sm"
          >
            Find Your First Contact
          </button>
          <button
            onClick={() => {
              setDismissed(true);
              onNavigate("settings");
            }}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
          >
            Set up your profile first
          </button>
        </div>
      </div>
    </div>
  );
}
