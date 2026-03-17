import { Check, X, Users, Lock, Zap } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface Contact {
  id: number;
  verificationStatus: string;
}

export function Subscription() {
  const [activeTab, setActiveTab] = useState<"plan" | "credits">("plan");

  const { data: allContacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/all"],
  });

  const tabs = [
    { id: "plan" as const, label: "Plan" },
    { id: "credits" as const, label: "Credits" },
  ];

  const plans = [
    {
      name: "Free",
      contactCredits: "50/month",
      personalEmail: true,
      professionalEmail: false,
      phoneNumbers: false,
      exportCredits: "50/month",
      isCurrent: true,
    },
    {
      name: "Growth",
      contactCredits: "1,000/month",
      personalEmail: true,
      professionalEmail: true,
      phoneNumbers: true,
      exportCredits: "1,000/month",
      isCurrent: false,
    },
    {
      name: "Business",
      contactCredits: "Custom",
      personalEmail: true,
      professionalEmail: true,
      phoneNumbers: true,
      exportCredits: "Custom",
      isCurrent: false,
    },
  ];

  const creditsUsed = allContacts.length;
  const creditsTotal = 50;
  const creditsRemaining = Math.max(0, creditsTotal - creditsUsed);

  const renderPlanTab = () => (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-purple-100 text-[#6B46C1] rounded-full font-medium">
                Free Plan
              </span>
            </div>
            <p className="text-[#718096] mb-4">
              You're on the free tier. Upgrade for more credits and features.
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#94A3B8] text-sm">
            <Lock className="w-4 h-4" />
            Paid plans coming soon
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden mb-8">
        <div className="p-6 border-b border-[#E2E8F0]">
          <h2 className="text-[#1A202C]">Plan Comparison</h2>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F9FAFB] border-b border-[#E2E8F0]">
              <tr>
                <th className="text-left text-[#A0AEC0] font-medium text-xs uppercase tracking-wider py-4 px-6">
                  Feature
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.name}
                    className="text-left text-[#1A202C] font-semibold py-4 px-6"
                  >
                    <div className="flex items-center gap-2">
                      {plan.name}
                      {plan.isCurrent && (
                        <span className="text-[10px] font-medium bg-purple-100 text-[#6B46C1] px-2 py-0.5 rounded-full">Current</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E2E8F0]">
                <td className="py-4 px-6 text-[#718096] font-medium">Contact Credits</td>
                {plans.map((plan) => (
                  <td key={plan.name} className="py-4 px-6 text-[#1A202C]">
                    {plan.contactCredits}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E2E8F0] bg-[#F9FAFB]">
                <td className="py-4 px-6 text-[#718096] font-medium">Personal Email</td>
                {plans.map((plan) => (
                  <td key={plan.name} className="py-4 px-6">
                    {plan.personalEmail ? (
                      <Check className="w-5 h-5 text-[#48BB78]" />
                    ) : (
                      <X className="w-5 h-5 text-[#A0AEC0]" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E2E8F0]">
                <td className="py-4 px-6 text-[#718096] font-medium">Professional Email</td>
                {plans.map((plan) => (
                  <td key={plan.name} className="py-4 px-6">
                    {plan.professionalEmail ? (
                      <Check className="w-5 h-5 text-[#48BB78]" />
                    ) : (
                      <X className="w-5 h-5 text-[#A0AEC0]" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E2E8F0] bg-[#F9FAFB]">
                <td className="py-4 px-6 text-[#718096] font-medium">Phone Numbers</td>
                {plans.map((plan) => (
                  <td key={plan.name} className="py-4 px-6">
                    {plan.phoneNumbers ? (
                      <Check className="w-5 h-5 text-[#48BB78]" />
                    ) : (
                      <X className="w-5 h-5 text-[#A0AEC0]" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E2E8F0]">
                <td className="py-4 px-6 text-[#718096] font-medium">Export Credits</td>
                {plans.map((plan) => (
                  <td key={plan.name} className="py-4 px-6 text-[#1A202C]">
                    {plan.exportCredits}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-6 space-y-6">
          {plans.map((plan) => (
            <div key={plan.name} className={`border rounded-lg p-4 ${plan.isCurrent ? 'border-[#6B46C1] bg-purple-50' : 'border-[#E2E8F0]'}`}>
              <h3 className="text-[#1A202C] mb-4 flex items-center gap-2">
                {plan.name}
                {plan.isCurrent && (
                  <span className="text-[10px] font-medium bg-purple-100 text-[#6B46C1] px-2 py-0.5 rounded-full">Current</span>
                )}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#718096]">Contact Credits</span>
                  <span className="text-[#1A202C] font-medium">{plan.contactCredits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#718096]">Personal Email</span>
                  {plan.personalEmail ? <Check className="w-5 h-5 text-[#48BB78]" /> : <X className="w-5 h-5 text-[#A0AEC0]" />}
                </div>
                <div className="flex justify-between">
                  <span className="text-[#718096]">Professional Email</span>
                  {plan.professionalEmail ? <Check className="w-5 h-5 text-[#48BB78]" /> : <X className="w-5 h-5 text-[#A0AEC0]" />}
                </div>
                <div className="flex justify-between">
                  <span className="text-[#718096]">Phone Numbers</span>
                  {plan.phoneNumbers ? <Check className="w-5 h-5 text-[#48BB78]" /> : <X className="w-5 h-5 text-[#A0AEC0]" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderCreditsTab = () => {
    const percentage = creditsTotal > 0 ? (creditsRemaining / creditsTotal) * 100 : 0;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-[#6B46C1]" />
            </div>
            <div className="flex-1">
              <h2 className="text-[#1A202C] mb-2">Contact Credits</h2>
              <p className="text-[#718096]">
                Every time you discover contacts for a new job posting, it uses credits based on the number of contacts found.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-[#A0AEC0] text-sm">Credits Remaining:</span>
              <span className="text-2xl font-bold text-[#1A202C]">{creditsRemaining}</span>
              <span className="text-[#718096]">of {creditsTotal}</span>
            </div>

            <div className="w-full bg-[#E2E8F0] rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  percentage > 50 ? 'bg-gradient-to-r from-[#6B46C1] to-[#9F7AEA]' :
                  percentage > 20 ? 'bg-gradient-to-r from-[#d97706] to-[#f59e0b]' :
                  'bg-gradient-to-r from-[#dc2626] to-[#ef4444]'
                }`}
                style={{ width: `${percentage}%` }}
              ></div>
            </div>

            <p className="text-[#718096] text-sm">Credits reset at the start of each billing cycle.</p>
            <p className="text-[#718096] text-sm font-medium">You will never be double-charged for revealing the same contact.</p>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-[#6B46C1]" />
            <h3 className="text-[#1A202C]">Need More Credits?</h3>
          </div>
          <p className="text-[#718096] mb-4">
            Paid plans with higher credit limits are coming soon. Contact us if you need more credits in the meantime.
          </p>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#94A3B8] text-sm w-fit">
            <Lock className="w-4 h-4" />
            Upgrade options coming soon
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[#1A202C] mb-4">Plan and Billing</h1>
        <p className="text-[#718096]">View your plan details and credit usage</p>
      </div>

      <div className="border-b border-[#E2E8F0] mb-8">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-[#6B46C1]"
                  : "text-[#718096] hover:text-[#1A202C]"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6B46C1]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "plan" && renderPlanTab()}
      {activeTab === "credits" && renderCreditsTab()}
    </div>
  );
}
