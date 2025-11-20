import { Key, Mail, Lock, User, ArrowRight } from "lucide-react";
import { useState } from "react";

interface SignupScreenProps {
  onNavigate: (page: string) => void;
  onSignup: () => void;
}

export function SignupScreen({ onNavigate, onSignup }: SignupScreenProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (password !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          email, 
          password,
          firstName,
          lastName,
        }),
      });

      if (response.ok) {
        onSignup();
        // Reload to trigger auth check and redirect to dashboard
        window.location.href = '/';
      } else {
        const data = await response.json();
        alert(data.message || 'Signup failed');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert('Signup failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7F5FF] to-[#FAFBFC] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl" />
      </div>

      {/* Signup Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-lg py-12 px-8 sm:px-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-[#1A202C] text-[17px]">The Side Door</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-[#1A202C] mb-2">Create your account</h1>
            <p className="text-[15px] text-[#718096]">Get started with Side Door in seconds</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6" style={{ maxWidth: '384px', marginLeft: 'auto', marginRight: 'auto' }}>
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block text-[14px] font-medium text-[#1A202C] mb-2">
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                  className="w-full px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                />
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block text-[14px] font-medium text-[#1A202C] mb-2">
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                  className="w-full px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                />
              </div>
            </div>

            {/* Email */}
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

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-[14px] font-medium text-[#1A202C] mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Lock className="w-4 h-4 text-[#A0AEC0]" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                />
              </div>
              <p className="text-[12px] text-[#A0AEC0] mt-1.5">Must be at least 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-[14px] font-medium text-[#1A202C] mb-2">
                Confirm password
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#6B46C1] hover:bg-[#5a3ba1] disabled:bg-[#9F7AEA] text-white px-4 py-3 rounded-lg transition-all font-medium text-[14px] shadow-sm flex items-center justify-center gap-2 mt-8 mb-6"
            >
              {isLoading ? (
                "Creating account..."
              ) : (
                <>
                  Sign up
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-[#A0AEC0]">or</span>
            </div>
          </div>

          {/* Login Link */}
          <div className="text-center mt-4 mb-4">
            <p className="text-[14px] text-[#718096]">
              Already have an account?{" "}
              <button
                onClick={() => onNavigate("login")}
                className="text-[#6B46C1] hover:text-[#5a3ba1] font-medium transition-colors"
              >
                Log in →
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-[13px] text-[#A0AEC0]">
            By continuing, you agree to our{" "}
            <a href="#" className="text-[#718096] hover:text-[#6B46C1] transition-colors">
              Terms
            </a>{" "}
            and{" "}
            <a href="#" className="text-[#718096] hover:text-[#6B46C1] transition-colors">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
