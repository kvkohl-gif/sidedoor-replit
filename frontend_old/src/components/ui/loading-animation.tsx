import { cn } from "@/lib/utils";

interface LoadingAnimationProps {
  type?: "submission" | "search" | "verification" | "default";
  message?: string;
  className?: string;
}

export function LoadingAnimation({ 
  type = "default", 
  message,
  className 
}: LoadingAnimationProps) {
  const getAnimation = () => {
    switch (type) {
      case "submission":
        return (
          <div className="flex flex-col items-center space-y-4">
            {/* Processing animation */}
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin">
                <div className="absolute top-0 left-0 w-4 h-4 bg-blue-600 rounded-full animate-bounce"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-slate-700">
                {message || "Processing your job submission..."}
              </p>
              <div className="flex items-center justify-center mt-2 space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        );

      case "search":
        return (
          <div className="flex flex-col items-center space-y-4">
            {/* Search animation */}
            <div className="relative">
              <div className="w-12 h-12 border-3 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 text-emerald-600">
                  🔍
                </div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-slate-700">
                {message || "Searching for recruiter contacts..."}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Using Apollo API to find real professionals
              </p>
            </div>
          </div>
        );

      case "verification":
        return (
          <div className="flex flex-col items-center space-y-4">
            {/* Verification animation */}
            <div className="relative">
              <div className="flex space-x-1">
                <div className="w-3 h-8 bg-purple-400 rounded animate-pulse" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-6 bg-purple-500 rounded animate-pulse" style={{ animationDelay: '100ms' }}></div>
                <div className="w-3 h-10 bg-purple-600 rounded animate-pulse" style={{ animationDelay: '200ms' }}></div>
                <div className="w-3 h-4 bg-purple-400 rounded animate-pulse" style={{ animationDelay: '300ms' }}></div>
                <div className="w-3 h-7 bg-purple-500 rounded animate-pulse" style={{ animationDelay: '400ms' }}></div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-slate-700">
                {message || "Verifying email addresses..."}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Using NeverBounce for accuracy
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center space-y-4">
            {/* Default loading */}
            <div className="relative">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-lg font-medium text-slate-700">
              {message || "Loading..."}
            </p>
          </div>
        );
    }
  };

  return (
    <div className={cn("flex items-center justify-center p-8", className)}>
      {getAnimation()}
    </div>
  );
}

// Multi-step loading component for complex processes
interface MultiStepLoadingProps {
  steps: Array<{
    id: string;
    label: string;
    status: "pending" | "active" | "completed" | "error";
  }>;
  className?: string;
}

export function MultiStepLoading({ steps, className }: MultiStepLoadingProps) {
  return (
    <div className={cn("flex flex-col items-center space-y-6 p-8", className)}>
      <div className="w-16 h-16 relative">
        {/* Animated circles */}
        <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-4 border-emerald-200 rounded-full animate-spin animate-reverse" style={{ animationDirection: 'reverse' }}></div>
        <div className="absolute inset-4 border-4 border-purple-200 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 bg-blue-600 rounded-full animate-pulse"></div>
        </div>
      </div>
      
      <div className="space-y-3 w-full max-w-md">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-3">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
              step.status === "completed" && "bg-emerald-500 text-white",
              step.status === "active" && "bg-blue-500 text-white animate-pulse",
              step.status === "pending" && "bg-slate-200 text-slate-500",
              step.status === "error" && "bg-red-500 text-white"
            )}>
              {step.status === "completed" ? "✓" : 
               step.status === "error" ? "✗" : 
               index + 1}
            </div>
            <span className={cn(
              "text-sm",
              step.status === "completed" && "text-emerald-600 font-medium",
              step.status === "active" && "text-blue-600 font-medium",
              step.status === "pending" && "text-slate-500",
              step.status === "error" && "text-red-600 font-medium"
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}