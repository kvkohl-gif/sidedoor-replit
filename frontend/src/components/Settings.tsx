import { Bell, Shield, Lock } from "lucide-react";
import { useState } from "react";

export function Settings() {
  const [autoProfileEmails, setAutoProfileEmails] = useState(true);
  const [emailStrictMode, setEmailStrictMode] = useState(true);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#1A202C] mb-2">Settings</h1>
        <p className="text-[#718096]">Configure your email preferences</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Automated Profile Info Emails */}
        <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bell className="w-6 h-6 text-[#4299E1]" />
            </div>
            <div className="flex-1">
              <h2 className="text-[#1A202C] mb-2">Automated Profile Info Emails</h2>
              <p className="text-[#718096] mb-3">
                When a candidate responds to your sequence, we'll automatically send you an email with
                their profile information.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-lg border border-[#E2E8F0]">
            <div className="flex-1">
              <p className="text-[#1A202C] font-medium mb-1">Enable Automated Emails</p>
              <p className="text-[#718096] text-sm">
                The candidate cannot view this email, and their profile information will not be shared
                with them.
              </p>
            </div>
            <button
              onClick={() => setAutoProfileEmails(!autoProfileEmails)}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:ring-offset-2 ${
                autoProfileEmails ? "bg-[#6B46C1]" : "bg-[#E2E8F0]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  autoProfileEmails ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Email Strict Mode */}
        <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-[#48BB78]" />
            </div>
            <div className="flex-1">
              <h2 className="text-[#1A202C] mb-2">Email Strict Mode</h2>
              <p className="text-[#718096] mb-3">
                Only send emails to contacts with verified email addresses. This helps reduce bounce
                rates and maintain a healthy sender reputation but reduces email inbox coverage.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 bg-[#F9FAFB] rounded-lg border border-[#E2E8F0] cursor-pointer hover:bg-purple-50 transition-colors">
              <input
                type="radio"
                name="email-mode"
                checked={emailStrictMode}
                onChange={() => setEmailStrictMode(true)}
                className="mt-1 w-4 h-4 text-[#6B46C1] border-[#E2E8F0] focus:ring-[#6B46C1]"
              />
              <div className="flex-1">
                <p className="text-[#1A202C] font-medium mb-1">
                  Only use verified email addresses
                </p>
                <p className="text-[#718096] text-sm">
                  Once enabled, unverified emails will not be used sending profiles in sequences.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 bg-[#F9FAFB] rounded-lg border border-[#E2E8F0] cursor-pointer hover:bg-purple-50 transition-colors">
              <input
                type="radio"
                name="email-mode"
                checked={!emailStrictMode}
                onChange={() => setEmailStrictMode(false)}
                className="mt-1 w-4 h-4 text-[#6B46C1] border-[#E2E8F0] focus:ring-[#6B46C1]"
              />
              <div className="flex-1">
                <p className="text-[#1A202C] font-medium mb-1">Use all email addresses</p>
                <p className="text-[#718096] text-sm">
                  Send emails to all contacts, including those with unverified email addresses.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Coming Soon Features */}
        <div className="bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-[#94A3B8]" />
            <h3 className="text-[#64748B] font-medium">Coming Soon</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {["Mailbox Integration", "Email Signatures", "CRM Connections", "Export & Reports"].map((feature) => (
              <div key={feature} className="px-4 py-3 bg-white border border-[#E2E8F0] text-[#94A3B8] rounded-lg flex items-center justify-between">
                <span>{feature}</span>
                <span className="text-[11px] font-medium bg-[#F1F5F9] text-[#94A3B8] px-2 py-0.5 rounded-full">Soon</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
