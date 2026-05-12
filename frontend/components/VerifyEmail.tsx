import { CheckCircle2, AlertCircle, Loader2, Key, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { verifyEmail } from "@/lib/auth";

interface VerifyEmailScreenProps {
  onNavigate: (page: string) => void;
  onLogin: () => void;
  token: string;
}

type VerifyState =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function VerifyEmailScreen({ onNavigate, onLogin, token }: VerifyEmailScreenProps) {
  const [state, setState] = useState<VerifyState>({ kind: "loading" });
  const [, setLocation] = useLocation();
  // React Strict Mode mounts components twice in dev, which would double-consume
  // the one-time verification token. Guard with a ref.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (!token) {
      setState({ kind: "error", message: "This link is missing a verification token." });
      return;
    }

    void (async () => {
      const result = await verifyEmail(token);
      if (result.success) {
        setState({ kind: "ok" });
        // Backend issued a session cookie — flip the app to authenticated.
        onLogin();
        // Brief pause so the user sees the success state before we redirect.
        setTimeout(() => setLocation("/dashboard"), 1200);
      } else {
        setState({
          kind: "error",
          message: result.error || result.message || "We couldn't verify this link.",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7F5FF] to-[#FAFBFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-lg py-12 px-8 sm:px-10 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-[#1A202C] text-[17px]">The Side Door</span>
            </div>
          </div>

          {state.kind === "loading" && (
            <>
              <div className="flex justify-center mb-6">
                <Loader2 className="w-10 h-10 text-[#6B46C1] animate-spin" />
              </div>
              <h1 className="text-[#1A202C] mb-2">Verifying your email…</h1>
              <p className="text-[15px] text-[#718096]">Just a moment.</p>
            </>
          )}

          {state.kind === "ok" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </div>
              </div>
              <h1 className="text-[#1A202C] mb-2">You're verified!</h1>
              <p className="text-[15px] text-[#718096] mb-6">Sending you into Side Door…</p>
            </>
          )}

          {state.kind === "error" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-red-600" />
                </div>
              </div>
              <h1 className="text-[#1A202C] mb-2">Verification failed</h1>
              <p className="text-[15px] text-[#718096] mb-6">{state.message}</p>
              <button
                onClick={() => onNavigate("login")}
                className="inline-flex items-center gap-2 bg-[#6B46C1] hover:bg-[#5a3ba1] text-white px-5 py-2.5 rounded-lg transition-all font-medium text-[14px]"
              >
                Go to log in
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[13px] text-[#A0AEC0] mt-4">
                You can request a new verification link from the login page.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
