import { Download, FileText } from "lucide-react";

export function BillingHistory() {
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

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#1A202C] mb-2">Billing History</h1>
        <p className="text-[#718096]">View and download your past invoices</p>
      </div>

      {/* Summary Cards */}
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

      {/* Invoices Table - Desktop */}
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

      {/* Invoice Cards - Mobile */}
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

      {/* Info Card */}
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
    </div>
  );
}
