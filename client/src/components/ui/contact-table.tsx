import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { 
  ExternalLink, 
  Copy,
  Edit3,
  Save,
  X,
  ChevronDown,
  Zap
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface Contact {
  id: number;
  name: string;
  title: string;
  email: string;
  linkedinUrl?: string;
  confidence: number;
  department: string;
  emailVerified: boolean;
  verificationStatus: string;
  sourcePlatform: string;
  apolloId?: string;
  isRecruiterRole: boolean;
  contactStatus?: string;
  notes?: string;
  lastContacted?: string;
  influenceScore?: number;
  emailDraft?: string;
  linkedinMessage?: string;
}

interface ContactTableProps {
  contacts: Contact[];
  submissionId: number;
}

export default function ContactTable({ contacts, submissionId }: ContactTableProps) {
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [generatingMessages, setGeneratingMessages] = useState<Set<number>>(new Set());
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, updates }: { contactId: number; updates: any }) => {
      return await apiRequest(`/api/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId.toString()] });
    },
  });

  // Generate message mutation
  const generateMessageMutation = useMutation({
    mutationFn: async ({ contactId, messageType, tone }: { contactId: number; messageType: string; tone: string }) => {
      return await apiRequest(`/api/contacts/${contactId}/generate-message`, {
        method: "POST",
        body: JSON.stringify({ messageType, tone }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId.toString()] });
      setGeneratingMessages(prev => {
        const next = new Set(prev);
        next.delete(variables.contactId);
        return next;
      });
      setExpandedMessages(prev => {
        const next = new Set(prev);
        next.add(variables.contactId);
        return next;
      });
      toast({
        title: "Messages Generated",
        description: "Email and LinkedIn messages have been generated",
      });
    },
    onError: (error, variables) => {
      setGeneratingMessages(prev => {
        const next = new Set(prev);
        next.delete(variables.contactId);
        return next;
      });
    },
  });

  const handleSaveNotes = (contact: Contact) => {
    updateContactMutation.mutate({
      contactId: contact.id,
      updates: { notes: notesValue },
    });
    setEditingNotes(null);
    setNotesValue("");
  };

  const handleGenerateMessages = (contact: Contact) => {
    setGeneratingMessages(prev => new Set([...prev, contact.id]));
    // Generate both email and linkedin messages
    generateMessageMutation.mutate({
      contactId: contact.id,
      messageType: 'email',
      tone: 'professional',
    });
  };

  const toggleMessageView = (contactId: number) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const getVerificationBadge = (status: string, isVerified: boolean) => {
    if (status === "valid" && isVerified) {
      return { variant: "default", className: "bg-green-100 text-green-800 border-green-200", text: "Valid", icon: "✓" };
    } else if (status === "risky" || status === "catchall") {
      return { variant: "outline", className: "bg-yellow-50 text-yellow-700 border-yellow-300", text: "Risky", icon: "⚠" };
    } else if (status === "invalid") {
      return { variant: "destructive", className: "bg-red-50 text-red-700 border-red-200", text: "Invalid", icon: "✗" };
    } else {
      return { variant: "secondary", className: "bg-gray-50 text-gray-600 border-gray-200", text: "Unknown", icon: "?" };
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return { variant: "default", className: "bg-green-50 text-green-700 border-green-200", text: "High" };
    } else if (confidence >= 70) {
      return { variant: "outline", className: "bg-yellow-50 text-yellow-600 border-yellow-300", text: "Medium" };
    } else {
      return { variant: "secondary", className: "bg-gray-50 text-gray-600 border-gray-200", text: "Low" };
    }
  };

  const getContactTypeBadge = (contact: Contact) => {
    if (contact.isRecruiterRole) {
      return { variant: "default", className: "bg-blue-50 text-blue-700 border-blue-200", text: "Recruiter" };
    } else {
      const title = contact.title.toLowerCase();
      if (title.includes("manager") || title.includes("director") || title.includes("head")) {
        return { variant: "outline", className: "bg-purple-50 text-purple-700 border-purple-200", text: "Hiring Manager" };
      } else {
        return { variant: "secondary", className: "bg-gray-50 text-gray-600 border-gray-200", text: "Other" };
      }
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-12 gap-6 text-xs font-semibold text-gray-700 uppercase tracking-wide">
          <div className="col-span-3">Contact</div>
          <div className="col-span-2">Title & Department</div>
          <div className="col-span-2">Type & Confidence</div>
          <div className="col-span-3">Email & Status</div>
          <div className="col-span-2">Actions & Notes</div>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-200">
        {contacts.map((contact) => {
          const verificationBadge = getVerificationBadge(contact.verificationStatus, contact.emailVerified);
          const confidenceBadge = getConfidenceBadge(contact.confidence);
          const contactTypeBadge = getContactTypeBadge(contact);
          const isGenerating = generatingMessages.has(contact.id);
          const hasMessages = contact.emailDraft || contact.linkedinMessage;
          const isExpanded = expandedMessages.has(contact.id);

          return (
            <div key={contact.id}>
              {/* Main Row */}
              <div className="px-6 py-5 hover:bg-blue-50/30 transition-all duration-200 border-l-4 border-l-transparent hover:border-l-blue-400">
                <div className="grid grid-cols-12 gap-6 items-start">
                  {/* Contact Info */}
                  <div className="col-span-3">
                    <div className="space-y-2">
                      <div className="font-semibold text-gray-900 text-base leading-tight">{contact.name}</div>
                      <div className="flex items-center gap-3">
                        {contact.linkedinUrl && (
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                            title="View LinkedIn Profile"
                          >
                            <ExternalLink className="h-4 w-4 mr-1.5" />
                            LinkedIn
                          </a>
                        )}
                        <div className="text-sm text-gray-500 capitalize">
                          {contact.sourcePlatform}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Title & Department */}
                  <div className="col-span-2">
                    <div className="space-y-1">
                      <div className="text-sm text-gray-900 font-medium leading-relaxed">{contact.title}</div>
                      <div className="text-sm text-gray-600">{contact.department}</div>
                    </div>
                  </div>

                  {/* Type & Confidence */}
                  <div className="col-span-2">
                    <div className="space-y-2">
                      <Badge {...contactTypeBadge} className={`text-sm px-3 py-1 font-medium ${contactTypeBadge.className}`}>
                        {contactTypeBadge.text}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Badge {...confidenceBadge} className={`text-xs px-2 py-1 ${confidenceBadge.className}`}>
                          {confidenceBadge.text}
                        </Badge>
                        <span className="text-xs text-gray-500 font-mono">{contact.confidence}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Email & Status */}
                  <div className="col-span-3">
                    {contact.email ? (
                      <div className="space-y-2">
                        <button
                          onClick={() => copyToClipboard(contact.email, "Email")}
                          className="text-sm text-blue-600 hover:text-blue-700 font-mono bg-blue-50 px-3 py-1 rounded border hover:bg-blue-100 transition-colors w-full text-left truncate"
                          title={`Copy ${contact.email}`}
                        >
                          {contact.email}
                        </button>
                        <Badge {...verificationBadge} className={`text-xs px-2 py-1 font-medium ${verificationBadge.className}`}>
                          {verificationBadge.icon} {verificationBadge.text}
                        </Badge>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 bg-gray-50 px-3 py-2 rounded border">
                        No email found
                      </div>
                    )}
                  </div>

                  {/* Actions & Notes */}
                  <div className="col-span-2">
                    <div className="space-y-3">
                      {/* Generate Button */}
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleGenerateMessages(contact)}
                          disabled={isGenerating || !contact.email}
                          size="sm"
                          className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium"
                          title="Generate outreach email and LinkedIn message"
                        >
                          {isGenerating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          ) : (
                            <Zap className="h-4 w-4 mr-2" />
                          )}
                          {isGenerating ? "Generating..." : "Generate"}
                        </Button>
                        {hasMessages && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleMessageView(contact.id)}
                            className="h-9 w-9 p-0"
                            title="View generated messages"
                          >
                            <ChevronDown 
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                            />
                          </Button>
                        )}
                      </div>

                      {/* Notes */}
                      {editingNotes === contact.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            placeholder="Add notes about this contact..."
                            className="min-h-[60px] text-sm resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveNotes(contact)}
                              disabled={updateContactMutation.isPending}
                              className="h-7 px-3 text-xs"
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingNotes(null);
                                setNotesValue("");
                              }}
                              className="h-7 px-3 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="text-sm text-gray-600 flex-1 min-h-[20px]">
                            {contact.notes ? (
                              <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-800">
                                {contact.notes.length > 50 ? `${contact.notes.substring(0, 50)}...` : contact.notes}
                              </div>
                            ) : (
                              <div className="text-gray-400 italic">No notes</div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingNotes(contact.id);
                              setNotesValue(contact.notes || "");
                            }}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 flex-shrink-0"
                            title="Edit notes"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Generated Messages Dropdown */}
              {hasMessages && (
                <Collapsible open={isExpanded}>
                  <CollapsibleContent>
                    <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-200">
                      <div className="space-y-4 max-w-4xl">
                        {contact.emailDraft && (
                          <Card className="border-gray-200">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-gray-900 text-sm">Email Draft</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(contact.emailDraft!, "Email draft")}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                              <div className="bg-white border rounded-md p-3 text-sm whitespace-pre-wrap">
                                {contact.emailDraft}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {contact.linkedinMessage && (
                          <Card className="border-gray-200">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-gray-900 text-sm">LinkedIn Message</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(contact.linkedinMessage!, "LinkedIn message")}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                              <div className="bg-white border rounded-md p-3 text-sm whitespace-pre-wrap">
                                {contact.linkedinMessage}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          );
        })}
      </div>

      {contacts.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <Zap className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>No contacts found</p>
        </div>
      )}
    </div>
  );
}