import { Key, Mail, ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";

interface ForgotPasswordScreenProps {
  onNavigate: (page: string) => void;
}

export function ForgotPasswordScreen({ onNavigate }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
        // DEV ONLY: display the reset link directly (remove once email is wired up)
        if (data.resetLink) {
          setResetLink(data.resetLink);
        }
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7F5FF] to-[#FAFBFC] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-lg py-12 px-8 sm:px-10">
          <div className="flex justify-center mb-8 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-[#1A202C] text-[17px]">The Side Door</span>
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-[#1A202C] mb-2">Reset your password</h1>
            <p className="text-[15px] text-[#718096]">
              {submitted
                ? "Check your email for a reset link"
                : "Enter your email and we'll send you a reset link"}
            </p>
          </div>

          {submitted ? (
            <div style={{ maxWidth: "384px", marginLeft: "auto", marginRight: "auto" }}>
              <div className="bg-[#F7F5FF] border border-[#E2E8F0] rounded-lg p-4 mb-6">
                <p className="text-[14px] text-[#1A202C]">
                  If an account exists for <strong>{email}</strong>, you will receive a password reset link.
                </p>
              </div>

              {/* DEV ONLY: Show reset link directly — remove once email sending is wired up */}
              {resetLink && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <p className="text-[12px] font-medium text-amber-700 mb-2">DEV ONLY — Reset link:</p>
                  <a
                    href={resetLink}
                    className="text-[13px] text-[#6B46C1] hover:text-[#5a3ba1] underline break-all"
                  >
                    {window.location.origin}{resetLink}
                  </a>
                </div>
              )}

              <button
                onClick={() => onNavigate("login")}
                className="w-full bg-[#6B46C1] hover:bg-[#5a3ba1] text-white px-4 py-3 rounded-lg transition-all font-medium text-[14px] shadow-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" style={{ maxWidth: "384px", marginLeft: "auto", marginRight: "auto" }}>
              <div>
                <label htmlFor="email" className="block text-[14px] font-medium text-[#1A202C] mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Mail className="w-4 h-4 text-[#A0AEC0]" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#6B46C1] hover:bg-[#5a3ba1] disabled:bg-[#9F7AEA] text-white px-4 py-3 rounded-lg transition-all font-medium text-[14px] shadow-sm flex items-center justify-center gap-2 mt-8 mb-6"
              >
                {isLoading ? "Sending..." : (
                  <>
                    Send reset link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-[#A0AEC0]">or</span>
            </div>
          </div>

          <div className="text-center mt-4 mb-4">
            <p className="text-[14px] text-[#718096]">
              Remember your password?{" "}
              <button
                onClick={() => onNavigate("login")}
                className="text-[#6B46C1] hover:text-[#5a3ba1] font-medium transition-colors"
              >
                Log in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
