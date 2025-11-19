import { Mail, Linkedin, Copy, CheckCircle, Zap, Edit2 } from "lucide-react";
import { useState } from "react";

interface ContactDetailProps {
  onNavigate: (page: string) => void;
}

export function ContactDetail({ onNavigate }: ContactDetailProps) {
  const [messagesGenerated, setMessagesGenerated] = useState(true);
  const [emailExpanded, setEmailExpanded] = useState(true);
  const [linkedinExpanded, setLinkedinExpanded] = useState(true);
  const [notes, setNotes] = useState("");

  const contact = {
    name: "Emily Rodriguez",
    title: "Senior Technical Recruiter",
    email: "emily.rodriguez@techcorp.com",
    linkedin: "https://linkedin.com/in/emilyrodriguez",
  };

  const emailMessage = {
    subject: "Excited About Senior Product Manager Role at TechCorp",
    body: `Hi Emily,

I hope this message finds you well. I came across the Senior Product Manager position at TechCorp Inc., and I'm very excited about the opportunity to contribute to your team.

With over 5 years of experience in product management, particularly in B2B SaaS environments, I believe I would be a strong fit for this role. I've successfully led cross-functional teams to deliver innovative products that have driven significant business growth.

I'm particularly drawn to TechCorp's mission and the opportunity to work on cutting-edge AI/ML products. My background in enterprise product management aligns well with the requirements outlined in the job description.

I'd love to discuss how my experience and skills could benefit your team. Would you be available for a brief call next week?

Thank you for your time and consideration.

Best regards,
[Your Name]
[Your LinkedIn Profile]
[Your Contact Info]`,
  };

  const linkedinMessage = {
    body: `Hi Emily,

I noticed you're recruiting for the Senior Product Manager role at TechCorp. With 5+ years in product management and a strong B2B SaaS background, I'm excited about this opportunity.

I'd love to learn more about the role and share how my experience could benefit your team. Are you available for a quick chat?

Thanks!
[Your Name]`,
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleGenerateMessages = () => {
    setMessagesGenerated(true);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Contact Header */}
      <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] p-6 mb-6">
        <h2 className="text-[#1A202C] mb-2">{contact.name}</h2>
        <p className="text-[#718096] mb-4">{contact.title}</p>

        {/* Contact Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-[#718096]" />
            <span className="text-[#1A202C] flex-1">{contact.email}</span>
            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full text-xs">
              <CheckCircle className="w-3 h-3 text-[#48BB78]" />
              <span className="text-[#48BB78]">Valid</span>
            </span>
            <button
              onClick={() => copyToClipboard(contact.email)}
              className="p-2 hover:bg-[#F9FAFB] rounded transition-colors"
              title="Copy email"
            >
              <Copy className="w-4 h-4 text-[#718096]" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Linkedin className="w-5 h-5 text-[#718096]" />
            <a
              href={contact.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6B46C1] hover:underline flex-1"
            >
              LinkedIn Profile
            </a>
          </div>
        </div>

        {/* Generate Button */}
        {!messagesGenerated && (
          <button
            onClick={handleGenerateMessages}
            className="mt-6 w-full md:w-auto px-6 py-3 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Generate Messages
          </button>
        )}
      </div>

      {/* Generated Messages Section */}
      {messagesGenerated && (
        <div className="space-y-6">
          {/* Email Message Card */}
          <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0] bg-[#F9FAFB]">
              <h3 className="text-[#1A202C]">Email Message</h3>
              <button
                onClick={() => copyToClipboard(`Subject: ${emailMessage.subject}\n\n${emailMessage.body}`)}
                className="px-4 py-2 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-2"
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

          {/* LinkedIn Message Card */}
          <div className="bg-white rounded-lg shadow-sm border border-[#E2E8F0] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[#E2E8F0] bg-[#F9FAFB]">
              <h3 className="text-[#1A202C]">LinkedIn Message</h3>
              <button
                onClick={() => copyToClipboard(linkedinMessage.body)}
                className="px-4 py-2 border border-[#E2E8F0] bg-white text-[#718096] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-2"
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

          {/* Regenerate Button */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
            <p className="text-[#718096] mb-3">
              Not satisfied with the generated messages? Click below to regenerate with different variations.
            </p>
            <button
              onClick={handleGenerateMessages}
              className="px-6 py-3 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <Zap className="w-5 h-5" />
              Regenerate Messages
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
        />
        {notes && (
          <button className="mt-3 px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors">
            Save Notes
          </button>
        )}
      </div>
    </div>
  );
}
