import { CreditCard, Check, X } from "lucide-react";

export function Subscription() {
  const plans = [
    {
      name: "Starter Plan",
      contactCredits: "250/month",
      personalEmail: true,
      professionalEmail: true,
      phoneNumbers: false,
      exportCredits: "250/seat/month",
    },
    {
      name: "Growth Plan",
      contactCredits: "1,000/seat/month",
      personalEmail: true,
      professionalEmail: true,
      phoneNumbers: true,
      exportCredits: "1,000/seat/month",
    },
    {
      name: "Business Plan",
      contactCredits: "Custom",
      personalEmail: true,
      professionalEmail: true,
      phoneNumbers: true,
      exportCredits: "Custom",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#1A202C] mb-4">Plan and Billing</h1>
        <p className="text-[#718096] mb-3">In this tab, you can:</p>
        <ul className="list-disc list-inside text-[#718096] space-y-1">
          <li>Update your subscription plan</li>
          <li>Change your payment method</li>
          <li>View billing history</li>
          <li>Cancel your plan</li>
        </ul>
      </div>

      {/* Current Plan Card */}
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-purple-100 text-[#6B46C1] rounded-full font-medium">
                Business Plan
              </span>
            </div>
            <p className="text-[#718096] mb-4">
              View and manage your billing history and plan details
            </p>
            <a href="#" className="text-[#6B46C1] hover:underline text-sm">
              Learn more about choosing a new billing plan →
            </a>
          </div>
          <button className="px-6 py-3 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors whitespace-nowrap">
            Manage Billing
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 pt-6 border-t border-[#E2E8F0]">
          <div>
            <label className="text-[#A0AEC0] text-xs uppercase tracking-wider block mb-2">
              Plan Details
            </label>
            <p className="text-[#1A202C] font-medium">Business Plan (Annual)</p>
            <p className="text-[#718096] text-sm">$299/month</p>
          </div>
          <div>
            <label className="text-[#A0AEC0] text-xs uppercase tracking-wider block mb-2">
              Renewal Date
            </label>
            <p className="text-[#1A202C] font-medium">January 15, 2025</p>
          </div>
          <div>
            <label className="text-[#A0AEC0] text-xs uppercase tracking-wider block mb-2">
              Payment Details
            </label>
            <p className="text-[#1A202C] font-medium">•••• 4242</p>
            <p className="text-[#718096] text-sm">Expires 12/2026</p>
          </div>
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden mb-8">
        <div className="p-6 border-b border-[#E2E8F0]">
          <h2 className="text-[#1A202C]">Credits: Overview</h2>
        </div>

        {/* Desktop Table */}
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
                    {plan.name}
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

        {/* Mobile Cards */}
        <div className="md:hidden p-6 space-y-6">
          {plans.map((plan) => (
            <div key={plan.name} className="border border-[#E2E8F0] rounded-lg p-4">
              <h3 className="text-[#1A202C] mb-4">{plan.name}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#718096]">Contact Credits</span>
                  <span className="text-[#1A202C] font-medium">{plan.contactCredits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#718096]">Personal Email</span>
                  {plan.personalEmail ? (
                    <Check className="w-5 h-5 text-[#48BB78]" />
                  ) : (
                    <X className="w-5 h-5 text-[#A0AEC0]" />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-[#718096]">Professional Email</span>
                  {plan.professionalEmail ? (
                    <Check className="w-5 h-5 text-[#48BB78]" />
                  ) : (
                    <X className="w-5 h-5 text-[#A0AEC0]" />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-[#718096]">Phone Numbers</span>
                  {plan.phoneNumbers ? (
                    <Check className="w-5 h-5 text-[#48BB78]" />
                  ) : (
                    <X className="w-5 h-5 text-[#A0AEC0]" />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-[#718096]">Export Credits</span>
                  <span className="text-[#1A202C] font-medium">{plan.exportCredits}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-[#F9FAFB] border-t border-[#E2E8F0]">
          <p className="text-[#718096] text-sm">
            For details on the number of contact and export credits available in your plan, please{" "}
            <a href="#" className="text-[#6B46C1] hover:underline">
              contact support
            </a>
          </p>
        </div>
      </div>

      {/* Payment Method Section */}
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6">
        <h2 className="text-[#1A202C] mb-4">Payment Method</h2>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1">
            <CreditCard className="w-6 h-6 text-[#718096]" />
            <div>
              <p className="text-[#1A202C] font-medium">•••• •••• •••• 4242</p>
              <p className="text-[#718096] text-sm">Expires 12/2026</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="px-6 py-3 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors">
            Change Payment Method
          </button>
          <button className="px-6 py-3 border border-[#F56565] bg-white text-[#F56565] rounded-lg hover:bg-red-50 transition-colors">
            Cancel Subscription
          </button>
        </div>
      </div>
    </div>
  );
}
