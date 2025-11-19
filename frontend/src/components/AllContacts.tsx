import {
  Search,
  Linkedin,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Mail,
  Eye,
  User,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface AllContactsProps {
  onNavigate: (page: string, data?: any) => void;
}

interface Contact {
  id: number;
  name: string | null;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  verificationStatus: string;
  jobSubmissionId: number;
  outreachBucket: string;
  createdAt: string;
  jobTitle?: string | null;
  companyName?: string | null;
}

export function AllContacts({ onNavigate }: AllContactsProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/all"],
  });

  const emailStatusConfig = {
    valid: {
      icon: CheckCircle,
      text: "Verified",
      color: "bg-green-50 text-green-700 border border-green-200",
      dotColor: "bg-green-500",
    },
    risky: {
      icon: AlertTriangle,
      text: "Risky",
      color: "bg-yellow-50 text-yellow-700 border border-yellow-200",
      dotColor: "bg-yellow-500",
    },
    invalid: {
      icon: XCircle,
      text: "Invalid",
      color: "bg-red-50 text-red-700 border border-red-200",
      dotColor: "bg-red-500",
    },
    unknown: {
      icon: HelpCircle,
      text: "Unverified",
      color: "bg-gray-50 text-gray-600 border border-gray-200",
      dotColor: "bg-gray-400",
    },
  };

  const filteredContacts = contacts.filter((contact) => {
    const contactType = contact.outreachBucket === "department_lead" ? "hiring-manager" : "recruiter";
    const matchesFilter = activeFilter === "all" || contactType === activeFilter;
    const matchesSearch = 
      (contact.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (contact.companyName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (contact.jobTitle?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#6B46C1] animate-spin mx-auto mb-4" />
          <p className="text-[#718096]">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[#1A202C] mb-2">Contacts</h1>
        <p className="text-[#718096]">
          Manage all your recruiter and hiring manager contacts
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A0AEC0]" />
          <input
            type="text"
            placeholder="Search by name, company, or role..."
            className="w-full h-12 pl-10 pr-4 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-[#718096]">Filter:</span>
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === "all"
                ? "bg-[#6B46C1] text-white"
                : "bg-white border border-[#E2E8F0] text-[#718096] hover:border-[#6B46C1]"
            }`}
            data-testid="filter-all"
          >
            All Contacts
          </button>
          <button
            onClick={() => setActiveFilter("recruiter")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === "recruiter"
                ? "bg-[#6B46C1] text-white"
                : "bg-white border border-[#E2E8F0] text-[#718096] hover:border-[#6B46C1]"
            }`}
            data-testid="filter-recruiter"
          >
            Recruiters
          </button>
          <button
            onClick={() => setActiveFilter("hiring-manager")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === "hiring-manager"
                ? "bg-[#6B46C1] text-white"
                : "bg-white border border-[#E2E8F0] text-[#718096] hover:border-[#6B46C1]"
            }`}
            data-testid="filter-hiring-manager"
          >
            Hiring Managers
          </button>
          <div className="ml-auto text-sm text-[#718096]">
            {filteredContacts.length} contacts
          </div>
        </div>
      </div>

      {/* Table - Desktop */}
      <div className="hidden lg:block bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              <th className="text-left text-[#718096] font-medium text-xs uppercase tracking-wider py-4 px-6">
                Contact
              </th>
              <th className="text-left text-[#718096] font-medium text-xs uppercase tracking-wider py-4 px-6">
                Company & Role
              </th>
              <th className="text-left text-[#718096] font-medium text-xs uppercase tracking-wider py-4 px-6">
                Email Status
              </th>
              <th className="text-left text-[#718096] font-medium text-xs uppercase tracking-wider py-4 px-6">
                Type
              </th>
              <th className="text-left text-[#718096] font-medium text-xs uppercase tracking-wider py-4 px-6">
                Added
              </th>
              <th className="text-right text-[#718096] font-medium text-xs uppercase tracking-wider py-4 px-6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {filteredContacts.map((contact) => {
              const statusConfig = emailStatusConfig[contact.verificationStatus as keyof typeof emailStatusConfig] || emailStatusConfig.unknown;
              const StatusIcon = statusConfig.icon;
              const contactType = contact.outreachBucket === "department_lead" ? "Hiring Manager" : "Recruiter";

              return (
                <tr
                  key={contact.id}
                  className="group hover:bg-[#F9FAFB] transition-colors"
                  data-testid={`contact-row-${contact.id}`}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[#1A202C] font-medium truncate">
                            {contact.name || "Unknown"}
                          </span>
                          {contact.linkedinUrl && (
                            <a 
                              href={contact.linkedinUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`link-linkedin-${contact.id}`}
                            >
                              <Linkedin className="w-4 h-4 text-[#718096] hover:text-[#0A66C2]" />
                            </a>
                          )}
                        </div>
                        <div className="text-sm text-[#718096] truncate">{contact.title || "Unknown Title"}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-6">
                    <div>
                      <button
                        onClick={() => onNavigate("job-details", { submissionId: contact.jobSubmissionId })}
                        className="text-[#1A202C] font-medium hover:text-[#6B46C1] transition-colors"
                        data-testid={`link-company-${contact.id}`}
                      >
                        {contact.companyName || "Unknown Company"}
                      </button>
                      <div className="text-sm text-[#718096]">{contact.jobTitle || "Unknown Position"}</div>
                    </div>
                  </td>

                  <td className="py-4 px-6">
                    <div className="flex flex-col gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium w-fit ${statusConfig.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></span>
                        {statusConfig.text}
                      </span>
                      <span className="text-sm text-[#718096] truncate">{contact.email || "No email"}</span>
                    </div>
                  </td>

                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                        contactType === "Recruiter"
                          ? "bg-purple-50 text-[#6B46C1] border border-purple-200"
                          : "bg-blue-50 text-[#4299E1] border border-blue-200"
                      }`}
                    >
                      {contactType}
                    </span>
                  </td>

                  <td className="py-4 px-6">
                    <span className="text-sm text-[#718096]">
                      {new Date(contact.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </span>
                  </td>

                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                        className="p-2 text-[#718096] hover:text-[#6B46C1] hover:bg-purple-50 rounded-lg transition-colors"
                        title="View Details"
                        data-testid={`button-view-${contact.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                        className="px-3 py-1.5 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors text-sm font-medium"
                        data-testid={`button-generate-${contact.id}`}
                      >
                        Generate
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cards - Mobile/Tablet */}
      <div className="lg:hidden space-y-3">
        {filteredContacts.map((contact) => {
          const statusConfig = emailStatusConfig[contact.verificationStatus as keyof typeof emailStatusConfig] || emailStatusConfig.unknown;
          const contactType = contact.outreachBucket === "department_lead" ? "Hiring Manager" : "Recruiter";

          return (
            <div
              key={contact.id}
              className="bg-white rounded-lg border border-[#E2E8F0] p-4"
              data-testid={`contact-card-${contact.id}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[#1A202C] font-medium truncate">{contact.name || "Unknown"}</h3>
                    {contact.linkedinUrl && (
                      <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="w-4 h-4 text-[#718096] flex-shrink-0" />
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-[#718096] mb-2">{contact.title || "Unknown Title"}</p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      contactType === "Recruiter"
                        ? "bg-purple-50 text-[#6B46C1]"
                        : "bg-blue-50 text-[#4299E1]"
                    }`}
                  >
                    {contactType}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div>
                  <button
                    onClick={() => onNavigate("job-details", { submissionId: contact.jobSubmissionId })}
                    className="text-[#1A202C] font-medium hover:text-[#6B46C1]"
                  >
                    {contact.companyName || "Unknown Company"}
                  </button>
                  <div className="text-sm text-[#718096]">{contact.jobTitle || "Unknown Position"}</div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#718096]">{contact.email || "No email"}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></span>
                    {statusConfig.text}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                className="w-full px-3 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors font-medium"
                data-testid={`button-view-mobile-${contact.id}`}
              >
                View & Generate Messages
              </button>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredContacts.length === 0 && (
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-12 text-center">
          <div className="w-16 h-16 bg-[#F9FAFB] rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-[#A0AEC0]" />
          </div>
          <h3 className="text-[#1A202C] mb-2">No contacts found</h3>
          <p className="text-[#718096]">
            {searchQuery ? "Try adjusting your search" : "No contacts available yet"}
          </p>
        </div>
      )}
    </div>
  );
}
