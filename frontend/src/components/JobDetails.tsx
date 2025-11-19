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
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
interface JobSubmissionWithRecruiters {
  id: number;
  jobTitle: string | null;
  companyName: string | null;
  companyDomain: string | null;
  jobInput: string;
  status: string;
  notes: string | null;
  recruiters: Array<{
    id: number;
    name: string | null;
    title: string | null;
    email: string | null;
    linkedinUrl: string | null;
    verificationStatus: string;
    emailDraft: string | null;
    linkedinMessage: string | null;
    outreachBucket: string;
  }>;
}

interface JobDetailsProps {
  submissionId?: number;
  onNavigate: (page: string, params?: Record<string, any>) => void;
}

export function JobDetails({ submissionId, onNavigate }: JobDetailsProps) {
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [generatedMessages, setGeneratedMessages] = useState<{ [key: number]: boolean }>({});

  const { data: submission, isLoading, error } = useQuery<JobSubmissionWithRecruiters>({
    queryKey: ["/api/submissions", submissionId],
    enabled: !!submissionId,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!submissionId) return;
      await apiRequest("PATCH", `/api/submissions/${submissionId}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId] });
    },
  });

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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        fallbackCopyTextToClipboard(text);
      });
    } else {
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

  const handleStatusChange = (newStatus: string) => {
    statusMutation.mutate(newStatus);
    setOpenStatusDropdown(false);
  };

  const getEmailMessage = (contactName: string, jobTitle?: string | null, companyName?: string | null) => ({
    subject: `Excited About ${jobTitle || 'This Role'} at ${companyName || 'Your Company'}`,
    body: `Hi ${contactName.split(" ")[0]},

I hope this message finds you well. I came across the ${jobTitle || 'position'} at ${companyName || 'your company'}, and I'm very excited about the opportunity to contribute to your team.

With over 5 years of experience in product management, particularly in B2B SaaS environments, I believe I would be a strong fit for this role. I've successfully led cross-functional teams to deliver innovative products that have driven significant business growth.

I'm particularly drawn to ${companyName || 'your company'}'s mission and the opportunity to work on cutting-edge products. My background in enterprise product management aligns well with the requirements outlined in the job description.

I'd love to discuss how my experience and skills could benefit your team. Would you be available for a brief call next week?

Thank you for your time and consideration.

Best regards,
[Your Name]
[Your LinkedIn Profile]
[Your Contact Info]`,
  });

  const getLinkedInMessage = (contactName: string, jobTitle?: string | null, companyName?: string | null) => ({
    body: `Hi ${contactName.split(" ")[0]},

I noticed you're recruiting for the ${jobTitle || 'position'} at ${companyName || 'your company'}. With 5+ years in product management and a strong B2B SaaS background, I'm excited about this opportunity.

I'd love to learn more about the role and share how my experience could benefit your team. Are you available for a quick chat?

Thanks!
[Your Name]`,
  });

  if (!submissionId) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <button
          onClick={() => onNavigate("job-history")}
          className="flex items-center gap-2 text-[#6B46C1] hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job History
        </button>
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-8 text-center">
          <p className="text-[#718096]">No submission ID provided. Please select a job from the history page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <button
          onClick={() => onNavigate("job-history")}
          className="flex items-center gap-2 text-[#6B46C1] hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job History
        </button>
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#6B46C1] animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <button
          onClick={() => onNavigate("job-history")}
          className="flex items-center gap-2 text-[#6B46C1] hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job History
        </button>
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-8 text-center">
          <p className="text-[#F56565] mb-2">Failed to load submission details</p>
          <p className="text-sm text-[#718096]">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const allContacts = submission.recruiters || [];
  
  const filteredContacts = allContacts.filter((contact) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "recruiter") return contact.outreachBucket === "recruiter";
    if (activeFilter === "hiring-manager") return contact.outreachBucket === "department_lead";
    return true;
  });

  const validContacts = allContacts.filter(c => c.verificationStatus === "valid").length;
  const recruiters = allContacts.filter(c => c.outreachBucket === "recruiter").length;
  const hiringManagers = allContacts.filter(c => c.outreachBucket === "department_lead").length;

  const selectedContactData = selectedContact ? allContacts.find(c => c.id === selectedContact) : null;

  const statusDisplayMap: { [key: string]: string } = {
    "not_contacted": "Not Contacted",
    "email_sent": "Reached Out",
    "awaiting_reply": "Reached Out",
    "follow_up_needed": "Reached Out",
    "rejected": "Responded",
    "interview_scheduled": "Responded",
  };

  const currentStatus = statusDisplayMap[submission.status || "not_contacted"] || "Not Contacted";

  const companyWebsite = submission.companyDomain 
    ? `https://${submission.companyDomain.replace(/^https?:\/\//, '')}`
    : null;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <button
        onClick={() => onNavigate("job-history")}
        className="flex items-center gap-2 text-[#6B46C1] hover:underline mb-6"
        data-testid="button-back-to-history"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Job History
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
            <h1 className="text-[#1A202C] mb-1" data-testid="text-job-title">
              {submission.jobTitle || "Job Title Not Available"}
            </h1>
            <p className="text-[#718096] mb-4" data-testid="text-company-name">
              {submission.companyName || "Company Not Available"}
            </p>
            
            <div className="flex items-center gap-2 text-sm text-[#718096] mb-6 pb-6 border-b border-[#E2E8F0]">
              <MapPin className="w-4 h-4" />
              <span>Location not specified</span>
            </div>

            <div className="relative mb-6">
              <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-2">
                Application Status
              </label>
              <button
                onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
                disabled={statusMutation.isPending}
                className={`w-full inline-flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 disabled:opacity-50 ${
                  currentStatus === "Not Contacted"
                    ? "bg-gray-50 text-gray-700 border-gray-200"
                    : currentStatus === "Reached Out"
                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                    : "bg-green-50 text-green-700 border-green-200"
                }`}
                data-testid="button-status-dropdown"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    currentStatus === "Not Contacted"
                      ? "bg-gray-400"
                      : currentStatus === "Reached Out"
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}></span>
                  {statusMutation.isPending ? "Updating..." : currentStatus}
                </div>
                <ChevronDown className="w-4 h-4" />
              </button>

              {openStatusDropdown && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 z-10">
                  {[
                    { display: "Not Contacted", value: "not_contacted" },
                    { display: "Reached Out", value: "email_sent" },
                    { display: "Responded", value: "interview_scheduled" }
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => handleStatusChange(status.value)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] transition-colors flex items-center gap-2 ${
                        currentStatus === status.display ? "bg-purple-50" : ""
                      }`}
                      data-testid={`button-status-${status.value}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        status.display === "Not Contacted"
                          ? "bg-gray-400"
                          : status.display === "Reached Out"
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}></span>
                      {status.display}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {companyWebsite && (
                <div>
                  <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-1">
                    Company Website
                  </label>
                  <a 
                    href={companyWebsite} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#6B46C1] hover:underline text-sm flex items-center gap-1"
                    data-testid="link-company-website"
                  >
                    {submission.companyDomain}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E2E8F0] p-6">
            <h3 className="text-[#1A202C] font-medium mb-4">Job Details</h3>
            <div className="text-sm text-[#718096] leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
              {submission.jobInput || "No job description available"}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[#1A202C] mb-1">Contacts</h2>
              <p className="text-sm text-[#718096]" data-testid="text-contact-stats">
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
                data-testid="button-filter-all"
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
                data-testid="button-filter-recruiter"
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
                data-testid="button-filter-hiring-manager"
              >
                Hiring Managers
              </button>
            </div>
          </div>

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
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#718096]">
                      No contacts found for this filter
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact, index) => {
                    const verificationStatus = contact.verificationStatus || "unknown";
                    const statusConfig = emailStatusConfig[verificationStatus as keyof typeof emailStatusConfig] || emailStatusConfig.unknown;
                    const StatusIcon = statusConfig.icon;
                    const hasGenerated = generatedMessages[contact.id];
                    const contactType = contact.outreachBucket === "department_lead" ? "Hiring Manager" : "Recruiter";

                    return (
                      <tr 
                        key={contact.id}
                        className={`group hover:bg-[#F9FAFB] transition-colors ${
                          index !== filteredContacts.length - 1 ? 'border-b border-[#E2E8F0]' : ''
                        }`}
                        data-testid={`row-contact-${contact.id}`}
                      >
                        <td className="py-4 px-6">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[#1A202C] font-medium" data-testid={`text-contact-name-${contact.id}`}>
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
                                  <Linkedin className="w-3.5 h-3.5 text-[#718096] hover:text-[#0A66C2]" />
                                </a>
                              )}
                            </div>
                            <div className="text-sm text-[#718096]" data-testid={`text-contact-title-${contact.id}`}>
                              {contact.title || "No title"}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusIcon className={`w-3.5 h-3.5 ${
                              verificationStatus === "valid" ? "text-[#48BB78]" :
                              verificationStatus === "risky" ? "text-[#ECC94B]" :
                              verificationStatus === "invalid" ? "text-[#F56565]" :
                              "text-[#A0AEC0]"
                            }`} />
                            <span className="text-xs text-[#A0AEC0]">{statusConfig.text}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-[#1A202C]" data-testid={`text-contact-email-${contact.id}`}>
                              {contact.email || "No email"}
                            </span>
                            {contact.email && (
                              <button
                                onClick={() => copyToClipboard(contact.email!)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white rounded"
                                data-testid={`button-copy-email-${contact.id}`}
                              >
                                <Copy className="w-3.5 h-3.5 text-[#718096]" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <span className="text-sm text-[#718096]" data-testid={`text-contact-type-${contact.id}`}>
                            {contactType}
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end">
                            {!hasGenerated ? (
                              <button
                                onClick={() => handleGenerateMessages(contact.id)}
                                className="px-3 py-1.5 border border-[#E2E8F0] text-[#718096] rounded-lg hover:bg-[#6B46C1] hover:text-white hover:border-[#6B46C1] transition-all text-sm font-medium flex items-center gap-1.5"
                                data-testid={`button-generate-${contact.id}`}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                Generate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleViewMessages(contact.id)}
                                className="px-3 py-1.5 border border-[#E2E8F0] text-[#718096] rounded-lg hover:bg-[#6B46C1] hover:text-white hover:border-[#6B46C1] transition-all text-sm font-medium flex items-center gap-1.5"
                                data-testid={`button-view-messages-${contact.id}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Message
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="border-t border-[#E2E8F0] p-6 text-center">
              <p className="text-sm text-[#718096] mb-3">Need more contacts?</p>
              <button 
                className="px-4 py-2 border border-[#6B46C1] text-[#6B46C1] rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium inline-flex items-center gap-2"
                data-testid="button-pull-more-contacts"
              >
                <Plus className="w-4 h-4" />
                Pull Additional Contacts (3 credits)
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedContact && selectedContactData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
                data-testid="button-close-modal"
              >
                <X className="w-5 h-5 text-[#718096]" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-[#F9FAFB] border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#718096]" />
                    <h3 className="text-[#1A202C] font-medium">Email Message</h3>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `Subject: ${getEmailMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).subject}\n\n${
                          getEmailMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).body
                        }`
                      )
                    }
                    className="px-3 py-1.5 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-2 text-sm"
                    data-testid="button-copy-email-message"
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
                      {getEmailMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).subject}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-[#A0AEC0] uppercase tracking-wider block mb-2">
                      Message
                    </label>
                    <div className="text-[#718096] whitespace-pre-wrap leading-relaxed bg-[#F9FAFB] p-4 rounded-lg text-sm">
                      {getEmailMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).body}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-[#F9FAFB] border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-4 h-4 text-[#718096]" />
                    <h3 className="text-[#1A202C] font-medium">LinkedIn Message</h3>
                  </div>
                  <button
                    onClick={() => copyToClipboard(getLinkedInMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).body)}
                    className="px-3 py-1.5 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-2 text-sm"
                    data-testid="button-copy-linkedin-message"
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
                    {getLinkedInMessage(selectedContactData.name || "there", submission.jobTitle, submission.companyName).body}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#E2E8F0]">
              <button
                onClick={() => setSelectedContact(null)}
                className="w-full px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors font-medium"
                data-testid="button-done-modal"
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
