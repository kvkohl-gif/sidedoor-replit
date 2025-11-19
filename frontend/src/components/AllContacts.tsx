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
} from "lucide-react";
import { useState } from "react";

interface AllContactsProps {
  onNavigate: (page: string) => void;
}

export function AllContacts({ onNavigate }: AllContactsProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const contacts = [
    {
      id: 1,
      name: "Emily Rodriguez",
      title: "Senior Technical Recruiter",
      type: "Recruiter",
      email: "emily.rodriguez@techcorp.com",
      emailStatus: "valid",
      job: "Senior Product Manager",
      company: "TechCorp Inc.",
      addedDate: "Dec 15, 2024",
      linkedin: "https://linkedin.com",
    },
    {
      id: 2,
      name: "Michael Chen",
      title: "Talent Acquisition Manager",
      type: "Recruiter",
      email: "m.chen@techcorp.com",
      emailStatus: "risky",
      job: "Senior Product Manager",
      company: "TechCorp Inc.",
      addedDate: "Dec 15, 2024",
      linkedin: "https://linkedin.com",
    },
    {
      id: 3,
      name: "Robert Martinez",
      title: "VP of Product",
      type: "Hiring Manager",
      email: "r.martinez@techcorp.com",
      emailStatus: "valid",
      job: "Senior Product Manager",
      company: "TechCorp Inc.",
      addedDate: "Dec 15, 2024",
      linkedin: "https://linkedin.com",
    },
    {
      id: 4,
      name: "Sarah Thompson",
      title: "Recruiting Coordinator",
      type: "Recruiter",
      email: "sarah.t@techcorp.com",
      emailStatus: "valid",
      job: "UX Designer",
      company: "Design Studios",
      addedDate: "Dec 10, 2024",
      linkedin: "https://linkedin.com",
    },
    {
      id: 5,
      name: "Amanda Lee",
      title: "Director of Product",
      type: "Hiring Manager",
      email: "a.lee@techcorp.com",
      emailStatus: "valid",
      job: "Senior Product Manager",
      company: "TechCorp Inc.",
      addedDate: "Dec 8, 2024",
      linkedin: "https://linkedin.com",
    },
    {
      id: 6,
      name: "David Park",
      title: "Technical Recruiter",
      type: "Recruiter",
      email: "email_not_unlocked@techcorp.com",
      emailStatus: "unknown",
      job: "Software Engineer",
      company: "StartupXYZ",
      addedDate: "Dec 8, 2024",
      linkedin: "https://linkedin.com",
    },
    {
      id: 7,
      name: "Jessica Williams",
      title: "Senior Recruiter",
      type: "Recruiter",
      email: "invalid@techcorp.com",
      emailStatus: "invalid",
      job: "Marketing Manager",
      company: "Global Marketing Co.",
      addedDate: "Dec 5, 2024",
      linkedin: "https://linkedin.com",
    },
  ];

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
    const matchesFilter = activeFilter === "all" || contact.type.toLowerCase().replace(" ", "-") === activeFilter;
    const matchesSearch = 
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.job.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A0AEC0]" />
          <input
            type="text"
            placeholder="Search by name, company, or role..."
            className="w-full h-12 pl-10 pr-4 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-[#718096]">Filter:</span>
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === "all"
                ? "bg-[#6B46C1] text-white"
                : "bg-white border border-[#E2E8F0] text-[#718096] hover:border-[#6B46C1]"
            }`}
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
              const statusConfig = emailStatusConfig[contact.emailStatus as keyof typeof emailStatusConfig];
              const StatusIcon = statusConfig.icon;

              return (
                <tr
                  key={contact.id}
                  className="group hover:bg-[#F9FAFB] transition-colors"
                >
                  {/* Contact Info */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[#1A202C] font-medium truncate">
                            {contact.name}
                          </span>
                          <a 
                            href={contact.linkedin} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Linkedin className="w-4 h-4 text-[#718096] hover:text-[#0A66C2]" />
                          </a>
                        </div>
                        <div className="text-sm text-[#718096] truncate">{contact.title}</div>
                      </div>
                    </div>
                  </td>

                  {/* Company & Role */}
                  <td className="py-4 px-6">
                    <div>
                      <button
                        onClick={() => onNavigate("job-details")}
                        className="text-[#1A202C] font-medium hover:text-[#6B46C1] transition-colors"
                      >
                        {contact.company}
                      </button>
                      <div className="text-sm text-[#718096]">{contact.job}</div>
                    </div>
                  </td>

                  {/* Email Status */}
                  <td className="py-4 px-6">
                    <div className="flex flex-col gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium w-fit ${statusConfig.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></span>
                        {statusConfig.text}
                      </span>
                      <span className="text-sm text-[#718096] truncate">{contact.email}</span>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                        contact.type === "Recruiter"
                          ? "bg-purple-50 text-[#6B46C1] border border-purple-200"
                          : "bg-blue-50 text-[#4299E1] border border-blue-200"
                      }`}
                    >
                      {contact.type}
                    </span>
                  </td>

                  {/* Added Date */}
                  <td className="py-4 px-6">
                    <span className="text-sm text-[#718096]">{contact.addedDate}</span>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onNavigate("contact-detail")}
                        className="p-2 text-[#718096] hover:text-[#6B46C1] hover:bg-purple-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onNavigate("contact-detail")}
                        className="px-3 py-1.5 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors text-sm font-medium"
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
          const statusConfig = emailStatusConfig[contact.emailStatus as keyof typeof emailStatusConfig];

          return (
            <div
              key={contact.id}
              className="bg-white rounded-lg border border-[#E2E8F0] p-4"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[#1A202C] font-medium truncate">{contact.name}</h3>
                    <a href={contact.linkedin} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="w-4 h-4 text-[#718096] flex-shrink-0" />
                    </a>
                  </div>
                  <p className="text-sm text-[#718096] mb-2">{contact.title}</p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      contact.type === "Recruiter"
                        ? "bg-purple-50 text-[#6B46C1]"
                        : "bg-blue-50 text-[#4299E1]"
                    }`}
                  >
                    {contact.type}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div>
                  <button
                    onClick={() => onNavigate("job-details")}
                    className="text-[#1A202C] font-medium hover:text-[#6B46C1]"
                  >
                    {contact.company}
                  </button>
                  <div className="text-sm text-[#718096]">{contact.job}</div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#718096]">{contact.email}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></span>
                    {statusConfig.text}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onNavigate("contact-detail")}
                className="w-full px-3 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors font-medium"
              >
                View & Generate Messages
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
