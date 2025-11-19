import { Mail, FileSignature, Bell, Shield, ChevronRight } from "lucide-react";
import { useState } from "react";

export function Settings() {
  const [autoProfileEmails, setAutoProfileEmails] = useState(true);
  const [emailStrictMode, setEmailStrictMode] = useState(true);

  const settingsSections = [
    {
      icon: Mail,
      title: "Connected Mailbox",
      description:
        "Configure your email sending settings, including sender name and daily email limits.",
      link: "Learn more about connecting mailboxes →",
      buttonText: "Edit Mailbox Settings",
    },
    {
      icon: FileSignature,
      title: "Email Signatures",
      description: "Add a professional signature to default from when sending email sequences.",
      link: "Learn more about email signatures →",
      buttonText: "Edit Signatures",
      note: "These settings have moved to the Integrations tab.",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#1A202C] mb-2">Settings</h1>
        <p className="text-[#718096]">Mailbox and Emails</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Connected Mailbox & Email Signatures */}
        {settingsSections.map((section, index) => {
          const Icon = section.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-[#6B46C1]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[#1A202C] mb-2">{section.title}</h2>
                  <p className="text-[#718096] mb-2">{section.description}</p>
                  {section.note && (
                    <p className="text-[#A0AEC0] text-sm mb-2">{section.note}</p>
                  )}
                  <a href="#" className="text-[#6B46C1] hover:underline text-sm">
                    {section.link}
                  </a>
                </div>
              </div>
              <button className="px-6 py-3 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-2">
                {section.buttonText}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}

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
      </div>

      {/* Additional Settings Navigation */}
      <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
        <h3 className="text-[#1A202C] mb-4">More Settings</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <button className="px-4 py-3 bg-white border border-[#E2E8F0] text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center justify-between">
            <span>Team Members</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="px-4 py-3 bg-white border border-[#E2E8F0] text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center justify-between">
            <span>CRM Connections</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="px-4 py-3 bg-white border border-[#E2E8F0] text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center justify-between">
            <span>Export Preferences</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="px-4 py-3 bg-white border border-[#E2E8F0] text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center justify-between">
            <span>Export History</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
