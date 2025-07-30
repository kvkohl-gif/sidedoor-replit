import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight,
  Mail, 
  Phone, 
  ExternalLink, 
  Copy,
  MessageSquare,
  Edit3,
  Save,
  X
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
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [editingMessages, setEditingMessages] = useState<{ [key: number]: { email?: boolean; linkedin?: boolean } }>({});
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId.toString()] });
      toast({
        title: "Message Generated",
        description: "New message has been generated successfully",
      });
    },
  });

  const toggleRow = (contactId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(contactId)) {
      newExpanded.delete(contactId);
    } else {
      newExpanded.add(contactId);
    }
    setExpandedRows(newExpanded);
  };

  const handleSaveNotes = (contact: Contact) => {
    updateContactMutation.mutate({
      contactId: contact.id,
      updates: { notes: notesValue },
    });
    setEditingNotes(null);
    setNotesValue("");
  };

  const handleGenerateMessage = (contact: Contact, messageType: 'email' | 'linkedin', tone: string = 'professional') => {
    generateMessageMutation.mutate({
      contactId: contact.id,
      messageType,
      tone,
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
      return { variant: "default", className: "bg-green-100 text-green-800", text: "Verified", icon: "✓" };
    } else if (status === "risky") {
      return { variant: "outline", className: "border-yellow-500 text-yellow-700", text: "Risky", icon: "⚠" };
    } else if (status === "invalid") {
      return { variant: "destructive", className: "", text: "Invalid", icon: "✗" };
    } else {
      return { variant: "secondary", className: "", text: "Unverified", icon: "?" };
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return { variant: "default", className: "bg-green-50 text-green-700 border-green-200", text: "High" };
    } else if (confidence >= 70) {
      return { variant: "outline", className: "border-yellow-500 text-yellow-600", text: "Medium" };
    } else {
      return { variant: "secondary", className: "bg-gray-50 text-gray-600", text: "Low" };
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <div className="col-span-1"></div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Title</div>
          <div className="col-span-2">Department</div>
          <div className="col-span-2">Email</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">Actions</div>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-200">
        {contacts.map((contact) => {
          const isExpanded = expandedRows.has(contact.id);
          const verificationBadge = getVerificationBadge(contact.verificationStatus, contact.emailVerified);
          const confidenceBadge = getConfidenceBadge(contact.confidence);

          return (
            <div key={contact.id}>
              {/* Main Row */}
              <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Expand Button */}
                  <div className="col-span-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(contact.id)}
                      className="h-6 w-6 p-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Name */}
                  <div className="col-span-3">
                    <div className="font-medium text-gray-900">{contact.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge {...confidenceBadge} className={`text-xs ${confidenceBadge.className}`}>
                        {confidenceBadge.text}
                      </Badge>
                      {contact.isRecruiterRole && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Recruiter
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="col-span-2">
                    <div className="text-sm text-gray-900">{contact.title}</div>
                  </div>

                  {/* Department */}
                  <div className="col-span-2">
                    <div className="text-sm text-gray-600">{contact.department}</div>
                  </div>

                  {/* Email */}
                  <div className="col-span-2">
                    {contact.email ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(contact.email, "Email")}
                          className="text-blue-600 hover:text-blue-700 p-0 h-auto font-normal text-sm"
                        >
                          {contact.email.length > 20 ? `${contact.email.substring(0, 20)}...` : contact.email}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No email</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    <Badge {...verificationBadge} className={`text-xs ${verificationBadge.className}`}>
                      {verificationBadge.icon}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1">
                    <div className="flex items-center gap-1">
                      {contact.email && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGenerateMessage(contact, 'email')}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      {contact.linkedinUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(contact.linkedinUrl, '_blank')}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              <Collapsible open={isExpanded}>
                <CollapsibleContent>
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Contact Details */}
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-medium text-gray-900 mb-3">Contact Details</h4>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Source:</span> {contact.sourcePlatform}</div>
                            <div><span className="font-medium">Confidence:</span> {contact.confidence}%</div>
                            {contact.apolloId && (
                              <div><span className="font-medium">Apollo ID:</span> {contact.apolloId}</div>
                            )}
                            {contact.linkedinUrl && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">LinkedIn:</span>
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => window.open(contact.linkedinUrl, '_blank')}
                                  className="p-0 h-auto text-blue-600"
                                >
                                  View Profile <ExternalLink className="h-3 w-3 ml-1" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Notes */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">Notes</h4>
                            {editingNotes !== contact.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingNotes(contact.id);
                                  setNotesValue(contact.notes || "");
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {editingNotes === contact.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                placeholder="Add notes about this contact..."
                                className="min-h-[60px] text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveNotes(contact)}
                                  disabled={updateContactMutation.isPending}
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
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600">
                              {contact.notes || "No notes added"}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Messages */}
                      {(contact.emailDraft || contact.linkedinMessage) && (
                        <Card className="lg:col-span-2">
                          <CardContent className="p-4">
                            <h4 className="font-medium text-gray-900 mb-3">Generated Messages</h4>
                            <div className="space-y-4">
                              {contact.emailDraft && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Email Draft</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(contact.emailDraft!, "Email draft")}
                                      className="h-6 px-2 text-xs"
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copy
                                    </Button>
                                  </div>
                                  <div className="bg-white border rounded p-3 text-sm">
                                    {contact.emailDraft}
                                  </div>
                                </div>
                              )}
                              {contact.linkedinMessage && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">LinkedIn Message</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(contact.linkedinMessage!, "LinkedIn message")}
                                      className="h-6 px-2 text-xs"
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copy
                                    </Button>
                                  </div>
                                  <div className="bg-white border rounded p-3 text-sm">
                                    {contact.linkedinMessage}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </div>

      {contacts.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>No contacts found</p>
        </div>
      )}
    </div>
  );
}