import {
  ArrowLeft,
  MapPin,
  ChevronDown,
  Mail,
  Linkedin,
  Copy,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Plus,
  ExternalLink,
  X,
  Sparkles,
  Eye,
} from "lucide-react";
import { useState } from "react";

interface JobDetailsProps {
  onNavigate: (page: string) => void;
}

export function JobDetails({ onNavigate }: JobDetailsProps) {
  const [jobStatus, setJobStatus] = useState("Not Contacted");
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [generatedMessages, setGeneratedMessages] = useState<{ [key: number]: boolean }>({});

  const allContacts = [
    {
      id: 1,
      name: "Emily Rodriguez",
      title: "Senior Technical Recruiter",
      type: "Recruiter",
      email: "emily.rodriguez@techcorp.com",
      emailStatus: "valid",
      linkedin: "https://linkedin.com/in/emilyrodriguez",
      confidence: 85,
    },
    {
      id: 2,
      name: "Michael Chen",
      title: "Talent Acquisition Manager",
      type: "Recruiter",
      email: "m.chen@techcorp.com",
      emailStatus: "risky",
      linkedin: "https://linkedin.com/in/michaelchen",
      confidence: 72,
    },
    {
      id: 3,
      name: "Robert Martinez",
      title: "VP of Product",
      type: "Hiring Manager",
      department: "Product Management",
      email: "r.martinez@techcorp.com",
      emailStatus: "valid",
      linkedin: "https://linkedin.com/in/robertmartinez",
      confidence: 88,
    },
    {
      id: 4,
      name: "Sarah Thompson",
      title: "Recruiting Coordinator",
      type: "Recruiter",
      email: "sarah.t@techcorp.com",
      emailStatus: "valid",
      linkedin: "https://linkedin.com/in/sarahthompson",
      confidence: 90,
    },
    {
      id: 5,
      name: "Amanda Lee",
      title: "Director of Product Management",
      type: "Hiring Manager",
      department: "Product Management",
      email: "a.lee@techcorp.com",
      emailStatus: "valid",
      linkedin: "https://linkedin.com/in/amandalee",
      confidence: 92,
    },
    {
      id: 6,
      name: "David Park",
      title: "Technical Recruiter",
      type: "Recruiter",
      email: "email_not_unlocked@techcorp.com",
      emailStatus: "unknown",
      linkedin: "https://linkedin.com/in/davidpark",
      confidence: 60,
    },
    {
      id: 7,
      name: "Jessica Williams",
      title: "Senior Recruiter",
      type: "Recruiter",
      email: "invalid@techcorp.com",
      emailStatus: "invalid",
      linkedin: "https://linkedin.com/in/jessicawilliams",
      confidence: 55,
    },
  ];

  const emailStatusConfig = {
    valid: {
      icon: CheckCircle,
      text: "Verified",
    },
    risky: {
      icon: AlertTriangle,
      text: "Risky",
    },
    invalid: {
      icon: XCircle,
      text: "Invalid",
    },
    unknown: {
      icon: HelpCircle,
      text: "Unverified",
    },
  };

  const copyToClipboard = (text: string) => {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        // Fallback to older method
        fallbackCopyTextToClipboard(text);
      });
    } else {
      // Fallback for browsers that don't support clipboard API
      fallbackCopyTextToClipboard(text);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  const handleGenerateMessages = (contactId: number) => {
    setGeneratedMessages({ ...generatedMessages, [contactId]: true });
    setSelectedContact(contactId);
  };

  const handleViewMessages = (contactId: number) => {
    setSelectedContact(contactId);
  };

  const getEmailMessage = (contactName: string) => ({
    subject: `Excited About Senior Product Manager Role at TechCorp`,
    body: `Hi ${contactName.split(" ")[0]},

I hope this message finds you well. I came across the Senior Product Manager position at TechCorp Inc., and I'm very excited about the opportunity to contribute to your team.

With over 5 years of experience in product management, particularly in B2B SaaS environments, I believe I would be a strong fit for this role. I've successfully led cross-functional teams to deliver innovative products that have driven significant business growth.

I'm particularly drawn to TechCorp's mission and the opportunity to work on cutting-edge AI/ML products. My background in enterprise product management aligns well with the requirements outlined in the job description.

I'd love to discuss how my experience and skills could benefit your team. Would you be available for a brief call next week?

Thank you for your time and consideration.

Best regards,
[Your Name]
[Your LinkedIn Profile]
[Your Contact Info]`,
  });

  const getLinkedInMessage = (contactName: string) => ({
    body: `Hi ${contactName.split(" ")[0]},

I noticed you're recruiting for the Senior Product Manager role at TechCorp. With 5+ years in product management and a strong B2B SaaS background, I'm excited about this opportunity.

I'd love to learn more about the role and share how my experience could benefit your team. Are you available for a quick chat?

Thanks!
[Your Name]`,
  });

  const filteredContacts = allContacts.filter((contact) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "recruiter") return contact.type === "Recruiter";
    if (activeFilter === "hiring-manager") return contact.type === "Hiring Manager";
    return true;
  });

  const validContacts = allContacts.filter(c => c.emailStatus === "valid").length;
  const recruiters = allContacts.filter(c => c.type === "Recruiter").length;
  const hiringManagers = allContacts.filter(c => c.type === "Hiring Manager").length;

  const selectedContactData = selectedContact ? allContacts.find(c => c.id === selectedContact) : null;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <button
        onClick={() => onNavigate("job-history")}
        className="flex items-center gap-2 text-[#6B46C1] hover:underline mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Job History
      </button>

      {/* Page Layout - Two Column on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar - Job Info */}
        <div className="lg:col-span-4 space-y-6">
          {/* Job Header */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
            <h1 className="text-[#1A202C] mb-1">Senior Product Manager</h1>
            <p className="text-[#718096] mb-4">TechCorp Inc.</p>
            
            <div className="flex items-center gap-2 text-sm text-[#718096] mb-6 pb-6 border-b border-[#E2E8F0]">
              <MapPin className="w-4 h-4" />
              <span>San Francisco, CA (Hybrid)</span>
            </div>

            {/* Status Dropdown */}
            <div className="relative mb-6">
              <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-2">
                Application Status
              </label>
              <button
                onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
                className={`w-full inline-flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 ${
                  jobStatus === "Not Contacted"
                    ? "bg-gray-50 text-gray-700 border-gray-200"
                    : jobStatus === "Reached Out"
                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                    : "bg-green-50 text-green-700 border-green-200"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    jobStatus === "Not Contacted"
                      ? "bg-gray-400"
                      : jobStatus === "Reached Out"
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}></span>
                  {jobStatus}
                </div>
                <ChevronDown className="w-4 h-4" />
              </button>

              {openStatusDropdown && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 z-10">
                  {["Not Contacted", "Reached Out", "Responded"].map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setJobStatus(status);
                        setOpenStatusDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] transition-colors flex items-center gap-2 ${
                        jobStatus === status ? "bg-purple-50" : ""
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        status === "Not Contacted"
                          ? "bg-gray-400"
                          : status === "Reached Out"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}></span>
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-1">
                  Company Website
                </label>
                <a href="#" className="text-[#6B46C1] hover:underline text-sm flex items-center gap-1">
                  techcorp.com
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-1">
                  Department
                </label>
                <span className="text-sm text-[#1A202C]">Product Management</span>
              </div>
            </div>
          </div>

          {/* Job Description */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
            <h3 className="text-[#1A202C] font-medium mb-4">About the Role</h3>
            <p className="text-sm text-[#718096] leading-relaxed mb-6">
              We're seeking an experienced Senior Product Manager to lead our core product initiatives.
              You'll work closely with engineering, design, and business stakeholders.
            </p>

            <div>
              <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-3">
                Key Requirements
              </label>
              <ul className="text-sm text-[#718096] space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#6B46C1] mt-1">•</span>
                  <span>5+ years product management experience</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6B46C1] mt-1">•</span>
                  <span>B2B SaaS background</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6B46C1] mt-1">•</span>
                  <span>Strong analytical skills</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#6B46C1] mt-1">•</span>
                  <span>Experience with AI/ML products</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Main Content - Contacts */}
        <div className="lg:col-span-8">
          {/* Header with filters and count */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[#1A202C] mb-1">Contacts</h2>
              <p className="text-sm text-[#718096]">
                {validContacts} verified • {recruiters} recruiters • {hiringManagers} hiring managers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeFilter === "all"
                    ? "bg-[#6B46C1] text-white"
                    : "text-[#718096] hover:bg-[#F9FAFB]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter("recruiter")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeFilter === "recruiter"
                    ? "bg-[#6B46C1] text-white"
                    : "text-[#718096] hover:bg-[#F9FAFB]"
                }`}
              >
                Recruiters
              </button>
              <button
                onClick={() => setActiveFilter("hiring-manager")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  activeFilter === "hiring-manager"
                    ? "bg-[#6B46C1] text-white"
                    : "text-[#718096] hover:bg-[#F9FAFB]"
                }`}
              >
                Hiring Managers
              </button>
            </div>
          </div>

          {/* Contacts Table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left text-[#A0AEC0] text-xs uppercase tracking-wider py-3 px-6">
                    Name
                  </th>
                  <th className="text-left text-[#A0AEC0] text-xs uppercase tracking-wider py-3 px-6">
                    Email
                  </th>
                  <th className="text-left text-[#A0AEC0] text-xs uppercase tracking-wider py-3 px-6">
                    Type
                  </th>
                  <th className="text-right text-[#A0AEC0] text-xs uppercase tracking-wider py-3 px-6">
                    
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact, index) => {
                  const statusConfig = emailStatusConfig[contact.emailStatus as keyof typeof emailStatusConfig];
                  const StatusIcon = statusConfig.icon;
                  const hasGenerated = generatedMessages[contact.id];

                  return (
                    <tr 
                      key={contact.id}
                      className={`group hover:bg-[#F9FAFB] transition-colors ${
                        index !== filteredContacts.length - 1 ? 'border-b border-[#E2E8F0]' : ''
                      }`}
                    >
                      {/* Contact Info */}
                      <td className="py-4 px-6">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[#1A202C] font-medium">{contact.name}</span>
                            <a 
                              href={contact.linkedin} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Linkedin className="w-3.5 h-3.5 text-[#718096] hover:text-[#0A66C2]" />
                            </a>
                          </div>
                          <div className="text-sm text-[#718096]">{contact.title}</div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusIcon className={`w-3.5 h-3.5 ${
                            contact.emailStatus === "valid" ? "text-[#48BB78]" :
                            contact.emailStatus === "risky" ? "text-[#ECC94B]" :
                            contact.emailStatus === "invalid" ? "text-[#F56565]" :
                            "text-[#A0AEC0]"
                          }`} />
                          <span className="text-xs text-[#A0AEC0]">{statusConfig.text}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-[#1A202C]">{contact.email}</span>
                          <button
                            onClick={() => copyToClipboard(contact.email)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white rounded"
                          >
                            <Copy className="w-3.5 h-3.5 text-[#718096]" />
                          </button>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-4 px-6">
                        <span className="text-sm text-[#718096]">
                          {contact.type}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end">
                          {!hasGenerated ? (
                            <button
                              onClick={() => handleGenerateMessages(contact.id)}
                              className="px-3 py-1.5 border border-[#E2E8F0] text-[#718096] rounded-lg hover:bg-[#6B46C1] hover:text-white hover:border-[#6B46C1] transition-all text-sm font-medium flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Generate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleViewMessages(contact.id)}
                              className="px-3 py-1.5 border border-[#E2E8F0] text-[#718096] rounded-lg hover:bg-[#6B46C1] hover:text-white hover:border-[#6B46C1] transition-all text-sm font-medium flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Message
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Get More Contacts CTA */}
            <div className="border-t border-[#E2E8F0] p-6 text-center">
              <p className="text-sm text-[#718096] mb-3">Need more contacts?</p>
              <button className="px-4 py-2 border border-[#6B46C1] text-[#6B46C1] rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Pull Additional Contacts (3 credits)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Message Generation Modal */}
      {selectedContact && selectedContactData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-[#1A202C] font-medium mb-1">Generated Messages</h2>
                <p className="text-sm text-[#718096]">
                  {selectedContactData.name} • {selectedContactData.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="p-2 hover:bg-[#F9FAFB] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#718096]" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Email Message */}
              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-[#F9FAFB] border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#718096]" />
                    <h3 className="text-[#1A202C] font-medium">Email Message</h3>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `Subject: ${getEmailMessage(selectedContactData.name).subject}\n\n${
                          getEmailMessage(selectedContactData.name).body
                        }`
                      )
                    }
                    className="px-3 py-1.5 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-2 text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>
                <div className="p-4">
                  <div className="mb-4">
                    <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-2">
                      Subject
                    </label>
                    <p className="text-[#1A202C] font-medium">
                      {getEmailMessage(selectedContactData.name).subject}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-2">
                      Message
                    </label>
                    <div className="text-[#718096] whitespace-pre-wrap leading-relaxed bg-[#F9FAFB] p-4 rounded-lg text-sm">
                      {getEmailMessage(selectedContactData.name).body}
                    </div>
                  </div>
                </div>
              </div>

              {/* LinkedIn Message */}
              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-[#F9FAFB] border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-4 h-4 text-[#718096]" />
                    <h3 className="text-[#1A202C] font-medium">LinkedIn Message</h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(getLinkedInMessage(selectedContactData.name).body)}
                    className="px-3 py-1.5 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-2 text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>
                <div className="p-4">
                  <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-2">
                    Message
                  </label>
                  <div className="text-[#718096] whitespace-pre-wrap leading-relaxed bg-[#F9FAFB] p-4 rounded-lg text-sm">
                    {getLinkedInMessage(selectedContactData.name).body}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#E2E8F0]">
              <button
                onClick={() => setSelectedContact(null)}
                className="w-full px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}