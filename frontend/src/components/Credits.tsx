import { Users, Download, FileText } from "lucide-react";

export function Credits() {
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

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#1A202C] mb-2">Credits</h1>
        <p className="text-[#718096]">
          See your available credits for contacting recruiters and hiring managers. If you run
          out, you'll be able to request more.
        </p>
      </div>

      {/* Credit Cards */}
      <div className="space-y-6">
        {creditTypes.map((credit, index) => {
          const Icon = credit.icon;
          const percentage = (credit.remaining / credit.total) * 100;

          return (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6"
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-[#6B46C1]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[#1A202C] mb-2">{credit.title}</h2>
                  <p className="text-[#718096]">{credit.description}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-[#A0AEC0] text-sm">Credits Remaining:</span>
                  <span className="text-2xl font-bold text-[#1A202C]">{credit.remaining}</span>
                  <span className="text-[#718096]">of {credit.total}</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#E2E8F0] rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-[#6B46C1] to-[#9F7AEA] h-3 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>

                {/* Additional Info */}
                <div className="space-y-2">
                  <p className="text-[#718096] text-sm">{credit.renewalText}</p>
                  {credit.note && (
                    <p className="text-[#718096] text-sm font-medium">{credit.note}</p>
                  )}
                </div>

                {/* Link */}
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

      {/* Info Card */}
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
    </div>
  );
}