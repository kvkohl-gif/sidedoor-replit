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
      <div className="bg-gray-50/80 border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
          <div className="col-span-2">Name</div>
          <div className="col-span-2">Job Title</div>
          <div className="col-span-1">Contact Type</div>
          <div className="col-span-1">Confidence</div>
          <div className="col-span-2">Email Status</div>
          <div className="col-span-1">Source</div>
          <div className="col-span-2">Notes</div>
          <div className="col-span-1">Actions</div>
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
              <div className="px-6 py-4 hover:bg-gray-50/60 transition-all duration-200">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Name */}
                  <div className="col-span-2">
                    <div className="font-semibold text-gray-900 text-sm mb-1">{contact.name}</div>
                    {contact.linkedinUrl && (
                      <a
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-blue-600 hover:text-blue-700"
                        title="View LinkedIn Profile"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        LinkedIn
                      </a>
                    )}
                  </div>

                  {/* Job Title */}
                  <div className="col-span-2">
                    <div className="text-sm text-gray-900 font-medium leading-relaxed">{contact.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{contact.department}</div>
                  </div>

                  {/* Contact Type */}
                  <div className="col-span-1">
                    <Badge {...contactTypeBadge} className={`text-xs px-2 py-1 ${contactTypeBadge.className}`}>
                      {contactTypeBadge.text}
                    </Badge>
                  </div>

                  {/* Confidence Level */}
                  <div className="col-span-1">
                    <Badge {...confidenceBadge} className={`text-xs px-2 py-1 ${confidenceBadge.className}`}>
                      {confidenceBadge.text}
                    </Badge>
                    <div className="text-xs text-gray-500 mt-0.5">{contact.confidence}%</div>
                  </div>

                  {/* Email Status */}
                  <div className="col-span-2">
                    {contact.email ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(contact.email, "Email")}
                            className="text-sm text-blue-600 hover:text-blue-700 font-mono truncate max-w-[140px]"
                            title={contact.email}
                          >
                            {contact.email}
                          </button>
                        </div>
                        <Badge {...verificationBadge} className={`text-xs px-2 py-0.5 ${verificationBadge.className}`}>
                          {verificationBadge.icon} {verificationBadge.text}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No email found</span>
                    )}
                  </div>

                  {/* Source */}
                  <div className="col-span-1">
                    <div className="text-xs text-gray-600 capitalize">{contact.sourcePlatform}</div>
                    {contact.apolloId && (
                      <div className="text-xs text-gray-400">ID: {contact.apolloId}</div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="col-span-2">
                    {editingNotes === contact.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Add notes..."
                          className="min-h-[50px] text-xs"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleSaveNotes(contact)}
                            disabled={updateContactMutation.isPending}
                            className="h-6 px-2 text-xs"
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingNotes(null);
                              setNotesValue("");
                            }}
                            className="h-6 px-2 text-xs"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-600 truncate flex-1">
                          {contact.notes || "No notes"}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingNotes(contact.id);
                            setNotesValue(contact.notes || "");
                          }}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleGenerateMessages(contact)}
                        disabled={isGenerating || !contact.email}
                        size="sm"
                        className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        title="Generate outreach email and LinkedIn message"
                      >
                        {isGenerating ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        ) : (
                          <Zap className="h-3 w-3 mr-1" />
                        )}
                        {isGenerating ? "..." : "Generate"}
                      </Button>
                      {hasMessages && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMessageView(contact.id)}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                          />
                        </Button>
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