import { useState } from "react";
import { CreditCard, Check, X, Users, Download, FileText } from "lucide-react";

export function Subscription() {
  const [activeTab, setActiveTab] = useState<"plan" | "credits" | "billing-history">("plan");

  const tabs = [
    { id: "plan" as const, label: "Plan" },
    { id: "credits" as const, label: "Credits" },
    { id: "billing-history" as const, label: "Billing History" },
  ];

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

  const creditTypes = [
    {
      icon: Users,
      title: "Contact Credits",
      description:
        "Every time you reveal a profile's email address and phone number, it counts as 1 credit. Contact credits are shared across your team.",
      remaining: 967,
      total: 1000,
      renewalText: "Your credits will renew on start of the next billing cycle.",
      note: "You will never be double-charged for revealing the same contact.",
      linkText: "Request More",
      linkHref: "#",
    },
  ];

  const invoices = [
    {
      id: 1,
      date: "12/01/2024",
      invoiceNumber: "INV-2024-12-001",
      plan: "Business Plan",
      amount: "$299.00",
      status: "Paid",
    },
    {
      id: 2,
      date: "11/01/2024",
      invoiceNumber: "INV-2024-11-001",
      plan: "Business Plan",
      amount: "$299.00",
      status: "Paid",
    },
    {
      id: 3,
      date: "10/01/2024",
      invoiceNumber: "INV-2024-10-001",
      plan: "Business Plan",
      amount: "$299.00",
      status: "Paid",
    },
    {
      id: 4,
      date: "09/01/2024",
      invoiceNumber: "INV-2024-09-001",
      plan: "Growth Plan",
      amount: "$199.00",
      status: "Paid",
    },
    {
      id: 5,
      date: "08/01/2024",
      invoiceNumber: "INV-2024-08-001",
      plan: "Growth Plan",
      amount: "$199.00",
      status: "Paid",
    },
    {
      id: 6,
      date: "07/01/2024",
      invoiceNumber: "INV-2024-07-001",
      plan: "Growth Plan",
      amount: "$199.00",
      status: "Paid",
    },
  ];

  const handleDownload = (invoiceNumber: string) => {
    console.log(`Downloading invoice: ${invoiceNumber}`);
  };

  const renderPlanTab = () => (
    <>
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

      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden mb-8">
        <div className="p-6 border-b border-[#E2E8F0]">
          <h2 className="text-[#1A202C]">Credits: Overview</h2>
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
    </>
  );

  const renderCreditsTab = () => (
    <>
      <div className="space-y-6">
        {creditTypes.map((credit, index) => {
          const Icon = credit.icon;
          const percentage = (credit.remaining / credit.total) * 100;

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
                  <h2 className="text-[#1A202C] mb-2">{credit.title}</h2>
                  <p className="text-[#718096]">{credit.description}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-[#A0AEC0] text-sm">Credits Remaining:</span>
                  <span className="text-2xl font-bold text-[#1A202C]">{credit.remaining}</span>
                  <span className="text-[#718096]">of {credit.total}</span>
                </div>

                <div className="w-full bg-[#E2E8F0] rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-[#6B46C1] to-[#9F7AEA] h-3 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>

                <div className="space-y-2">
                  <p className="text-[#718096] text-sm">{credit.renewalText}</p>
                  {credit.note && (
                    <p className="text-[#718096] text-sm font-medium">{credit.note}</p>
                  )}
                </div>

                <div className="pt-2">
                  <a
                    href={credit.linkHref}
                    className="text-[#6B46C1] hover:underline inline-flex items-center gap-1"
                  >
                    {credit.linkText}
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
        <h3 className="text-[#1A202C] mb-2">Need More Credits?</h3>
        <p className="text-[#718096] mb-4">
          If you're running low on credits, you can upgrade your plan or purchase additional credit
          packs. Contact our sales team for custom enterprise solutions.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="px-6 py-3 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors">
            Upgrade Plan
          </button>
          <button className="px-6 py-3 border border-[#6B46C1] bg-white text-[#6B46C1] rounded-lg hover:bg-purple-50 transition-colors">
            Contact Sales
          </button>
        </div>
      </div>
    </>
  );

  const renderBillingHistoryTab = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-[#6B46C1]" />
            <span className="text-[#A0AEC0] text-sm">Total Invoices</span>
          </div>
          <p className="text-2xl font-bold text-[#1A202C]">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[#A0AEC0] text-sm">Current Plan</span>
          </div>
          <p className="text-2xl font-bold text-[#1A202C]">Business</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[#A0AEC0] text-sm">Next Billing Date</span>
          </div>
          <p className="text-2xl font-bold text-[#1A202C]">Jan 15</p>
        </div>
      </div>

      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F9FAFB] border-b border-[#E2E8F0]">
              <tr>
                <th className="text-left text-[#A0AEC0] font-medium text-xs uppercase tracking-wider py-4 px-6">
                  Date
                </th>
                <th className="text-left text-[#A0AEC0] font-medium text-xs uppercase tracking-wider py-4 px-6">
                  Invoice Number
                </th>
                <th className="text-left text-[#A0AEC0] font-medium text-xs uppercase tracking-wider py-4 px-6">
                  Plan
                </th>
                <th className="text-left text-[#A0AEC0] font-medium text-xs uppercase tracking-wider py-4 px-6">
                  Amount
                </th>
                <th className="text-left text-[#A0AEC0] font-medium text-xs uppercase tracking-wider py-4 px-6">
                  Status
                </th>
                <th className="text-left text-[#A0AEC0] font-medium text-xs uppercase tracking-wider py-4 px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice, index) => (
                <tr
                  key={invoice.id}
                  className={`border-b border-[#E2E8F0] hover:bg-purple-50 transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"
                  }`}
                >
                  <td className="py-4 px-6 text-[#718096]">{invoice.date}</td>
                  <td className="py-4 px-6">
                    <a href="#" className="text-[#6B46C1] hover:underline font-medium">
                      {invoice.invoiceNumber}
                    </a>
                  </td>
                  <td className="py-4 px-6 text-[#718096]">{invoice.plan}</td>
                  <td className="py-4 px-6 text-[#1A202C] font-medium">{invoice.amount}</td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-[#48BB78] rounded-full text-xs font-medium">
                      {invoice.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => handleDownload(invoice.invoiceNumber)}
                      className="p-2 hover:bg-[#F9FAFB] rounded transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-5 h-5 text-[#718096] hover:text-[#6B46C1]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <a href="#" className="text-[#6B46C1] hover:underline font-medium block mb-1">
                  {invoice.invoiceNumber}
                </a>
                <p className="text-[#718096] text-sm">{invoice.date}</p>
              </div>
              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-[#48BB78] rounded-full text-xs font-medium">
                {invoice.status}
              </span>
            </div>
            <div className="space-y-2 text-sm mb-3 pb-3 border-b border-[#E2E8F0]">
              <div className="flex justify-between">
                <span className="text-[#A0AEC0]">Plan:</span>
                <span className="text-[#718096]">{invoice.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0AEC0]">Amount:</span>
                <span className="text-[#1A202C] font-medium">{invoice.amount}</span>
              </div>
            </div>
            <button
              onClick={() => handleDownload(invoice.invoiceNumber)}
              className="w-full px-4 py-2 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-[#1A202C] mb-2">Need Help?</h3>
        <p className="text-[#718096] mb-4">
          If you have questions about your billing or need a custom invoice, please contact our support
          team.
        </p>
        <button className="px-6 py-3 bg-[#4299E1] text-white rounded-lg hover:bg-[#3182ce] transition-colors">
          Contact Support
        </button>
      </div>
    </>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
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
      {activeTab === "billing-history" && renderBillingHistoryTab()}
    </div>
  );
}
