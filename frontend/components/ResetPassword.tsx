import { Key, Lock, ArrowRight, CheckCircle } from "lucide-react";
import { useState } from "react";

interface ResetPasswordScreenProps {
  onNavigate: (page: string) => void;
  token: string;
}

export function ResetPasswordScreen({ onNavigate, token }: ResetPasswordScreenProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
      } else {
        setPasswordError(data.error || "Failed to reset password");
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setPasswordError("Something went wrong. Please try again.");
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
            <h1 className="text-[#1A202C] mb-2">
              {success ? "Password reset!" : "Set new password"}
            </h1>
            <p className="text-[15px] text-[#718096]">
              {success
                ? "Your password has been updated successfully"
                : "Enter your new password below"}
            </p>
          </div>

          {success ? (
            <div style={{ maxWidth: "384px", marginLeft: "auto", marginRight: "auto" }}>
              <div className="flex justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <button
                onClick={() => onNavigate("login")}
                className="w-full bg-[#6B46C1] hover:bg-[#5a3ba1] text-white px-4 py-3 rounded-lg transition-all font-medium text-[14px] shadow-sm flex items-center justify-center gap-2"
              >
                Go to login
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : !token ? (
            <div style={{ maxWidth: "384px", marginLeft: "auto", marginRight: "auto" }}>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-[14px] text-red-700">
                  Invalid or missing reset token. Please request a new password reset link.
                </p>
              </div>
              <button
                onClick={() => onNavigate("forgot-password")}
                className="w-full bg-[#6B46C1] hover:bg-[#5a3ba1] text-white px-4 py-3 rounded-lg transition-all font-medium text-[14px] shadow-sm flex items-center justify-center gap-2"
              >
                Request new link
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" style={{ maxWidth: "384px", marginLeft: "auto", marginRight: "auto" }}>
              <div>
                <label htmlFor="newPassword" className="block text-[14px] font-medium text-[#1A202C] mb-2">
                  New password
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock className="w-4 h-4 text-[#A0AEC0]" />
                  </div>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                  />
                </div>
                <p className="text-[12px] text-[#A0AEC0] mt-1.5">Must be at least 8 characters</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-[14px] font-medium text-[#1A202C] mb-2">
                  Confirm new password
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock className="w-4 h-4 text-[#A0AEC0]" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                  />
                </div>
                {passwordError && (
                  <p className="text-[12px] text-red-600 mt-1.5">{passwordError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#6B46C1] hover:bg-[#5a3ba1] disabled:bg-[#9F7AEA] text-white px-4 py-3 rounded-lg transition-all font-medium text-[14px] shadow-sm flex items-center justify-center gap-2 mt-8 mb-6"
              >
                {isLoading ? "Resetting..." : (
                  <>
                    Reset password
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
