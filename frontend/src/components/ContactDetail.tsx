import { Mail, Linkedin, Copy, CheckCircle, Zap, Edit2, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";

interface ContactDetailProps {
  onNavigate: (page: string, data?: any) => void;
  contactId?: number;
}

interface Contact {
  id: number;
  name: string | null;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  verificationStatus: string;
  notes: string | null;
  generatedEmailMessage: string | null;
  generatedLinkedInMessage: string | null;
  jobSubmissionId: number;
  jobTitle?: string | null;
  companyName?: string | null;
}

export function ContactDetail({ onNavigate, contactId }: ContactDetailProps) {
  const [messagesGenerated, setMessagesGenerated] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ["/api/contacts", contactId],
    queryFn: async () => {
      if (!contactId) throw new Error("Contact ID is required");
      const response = await fetch(`/api/contacts/${contactId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch contact");
      return response.json();
    },
    enabled: !!contactId,
  });

  const generateMessageMutation = useMutation({
    mutationFn: async ({ messageType, tone }: { messageType: string; tone: string }) => {
      if (!contactId) throw new Error("Contact ID is required");
      const response = await apiRequest("POST", `/api/contacts/${contactId}/generate-message`, {
        messageType,
        tone,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId] });
      setMessagesGenerated(true);
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      if (!contactId) throw new Error("Contact ID is required");
      return await apiRequest("PATCH", `/api/contacts/${contactId}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleGenerateMessages = () => {
    generateMessageMutation.mutate({ messageType: "both", tone: "professional" });
  };

  const handleSaveNotes = () => {
    if (notes.trim()) {
      updateNotesMutation.mutate(notes);
    }
  };

  if (!contactId) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[#A0AEC0] mx-auto mb-4" />
          <h3 className="text-[#1A202C] mb-2">No Contact Selected</h3>
          <p className="text-[#718096]">Please select a contact to view details</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#6B46C1] animate-spin mx-auto mb-4" />
          <p className="text-[#718096]">Loading contact details...</p>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[#A0AEC0] mx-auto mb-4" />
          <h3 className="text-[#1A202C] mb-2">Contact Not Found</h3>
          <p className="text-[#718096]">The contact you're looking for doesn't exist</p>
        </div>
      </div>
    );
  }

  const hasGeneratedMessages = contact.generatedEmailMessage || contact.generatedLinkedInMessage;
  const showMessages = messagesGenerated || hasGeneratedMessages;

  if (contact.notes && !notes) {
    setNotes(contact.notes);
  }

  const emailMessage = {
    subject: `Interested in ${contact.jobTitle || "the position"} at ${contact.companyName || "your company"}`,
    body: contact.generatedEmailMessage || "No email message generated yet",
  };

  const linkedinMessage = {
    body: contact.generatedLinkedInMessage || "No LinkedIn message generated yet",
  };

  const verificationStatusConfig: Record<string, { text: string; color: string; icon: typeof CheckCircle }> = {
    valid: {
      text: "Valid",
      color: "bg-green-100 text-[#48BB78]",
      icon: CheckCircle,
    },
    risky: {
      text: "Risky",
      color: "bg-yellow-100 text-[#D69E2E]",
      icon: AlertCircle,
    },
    invalid: {
      text: "Invalid",
      color: "bg-red-100 text-[#F56565]",
      icon: AlertCircle,
    },
    unknown: {
      text: "Unverified",
      color: "bg-gray-100 text-[#718096]",
      icon: AlertCircle,
    },
  };

  const statusInfo = verificationStatusConfig[contact.verificationStatus] || verificationStatusConfig.unknown;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Contact Header */}
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6 mb-6">
        <h2 className="text-[#1A202C] mb-2">{contact.name || "Unknown Contact"}</h2>
        <p className="text-[#718096] mb-4">{contact.title || "Unknown Title"}</p>

        {/* Contact Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-[#718096]" />
            <span className="text-[#1A202C] flex-1">{contact.email || "No email"}</span>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusInfo.color}`}>
              <StatusIcon className="w-3 h-3" />
              <span>{statusInfo.text}</span>
            </span>
            {contact.email && (
              <button
                onClick={() => copyToClipboard(contact.email!)}
                className="p-2 hover:bg-[#F9FAFB] rounded transition-colors"
                title="Copy email"
                data-testid="button-copy-email"
              >
                <Copy className="w-4 h-4 text-[#718096]" />
              </button>
            )}
          </div>
          {contact.linkedinUrl && (
            <div className="flex items-center gap-3">
              <Linkedin className="w-5 h-5 text-[#718096]" />
              <a
                href={contact.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6B46C1] hover:underline flex-1"
                data-testid="link-linkedin"
              >
                LinkedIn Profile
              </a>
            </div>
          )}
        </div>

        {/* Generate Button */}
        {!showMessages && (
          <button
            onClick={handleGenerateMessages}
            disabled={generateMessageMutation.isPending}
            className="mt-6 w-full md:w-auto px-6 py-3 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors flex items-center justify-center gap-2 disabled:bg-[#E2E8F0] disabled:text-[#A0AEC0] disabled:cursor-not-allowed"
            data-testid="button-generate-messages"
          >
            {generateMessageMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Generate Messages
              </>
            )}
          </button>
        )}

        {generateMessageMutation.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Failed to generate messages. Please try again.
          </div>
        )}
      </div>

      {/* Generated Messages Section */}
      {showMessages && (
        <div className="space-y-6">
          {/* Email Message Card */}
          {(contact.generatedEmailMessage || messagesGenerated) && (
            <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0] bg-[#F9FAFB]">
                <h3 className="text-[#1A202C]">Email Message</h3>
                <button
                  onClick={() => copyToClipboard(`Subject: ${emailMessage.subject}\n\n${emailMessage.body}`)}
                  className="px-4 py-2 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-2"
                  data-testid="button-copy-email-message"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <label className="text-[#A0AEC0] text-xs uppercase tracking-wider block mb-2">
                    Subject
                  </label>
                  <p className="text-[#1A202C] font-medium">{emailMessage.subject}</p>
                </div>
                <div>
                  <label className="text-[#A0AEC0] text-xs uppercase tracking-wider block mb-2">
                    Message
                  </label>
                  <div className="text-[#718096] whitespace-pre-wrap leading-relaxed bg-[#F9FAFB] p-4 rounded-lg border border-[#E2E8F0]">
                    {emailMessage.body}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LinkedIn Message Card */}
          {(contact.generatedLinkedInMessage || messagesGenerated) && (
            <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0] bg-[#F9FAFB]">
                <h3 className="text-[#1A202C]">LinkedIn Message</h3>
                <button
                  onClick={() => copyToClipboard(linkedinMessage.body)}
                  className="px-4 py-2 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-2"
                  data-testid="button-copy-linkedin-message"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>
              <div className="p-6">
                <label className="text-[#A0AEC0] text-xs uppercase tracking-wider block mb-2">
                  Message
                </label>
                <div className="text-[#718096] whitespace-pre-wrap leading-relaxed bg-[#F9FAFB] p-4 rounded-lg border border-[#E2E8F0]">
                  {linkedinMessage.body}
                </div>
              </div>
            </div>
          )}

          {/* Regenerate Button */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
            <p className="text-[#718096] mb-3">
              Not satisfied with the generated messages? Click below to regenerate with different variations.
            </p>
            <button
              onClick={handleGenerateMessages}
              disabled={generateMessageMutation.isPending}
              className="px-6 py-3 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors flex items-center justify-center gap-2 mx-auto disabled:bg-[#E2E8F0] disabled:text-[#A0AEC0] disabled:cursor-not-allowed"
              data-testid="button-regenerate-messages"
            >
              {generateMessageMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Regenerate Messages
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Notes Section */}
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#1A202C]">Notes</h3>
          <Edit2 className="w-4 h-4 text-[#718096]" />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="No notes added"
          className="w-full h-32 p-4 border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent"
          data-testid="textarea-notes"
        />
        {notes && notes !== contact.notes && (
          <button 
            onClick={handleSaveNotes}
            disabled={updateNotesMutation.isPending}
            className="mt-3 px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#A0AEC0] disabled:cursor-not-allowed"
            data-testid="button-save-notes"
          >
            {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
          </button>
        )}
      </div>
    </div>
  );
}
