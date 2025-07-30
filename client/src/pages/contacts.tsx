import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  Copy,
  Edit3,
  Save,
  X,
  ChevronDown,
  Search,
  Users,
  Building
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Contact {
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
  notes?: string;
  emailDraft?: string;
  linkedinMessage?: string;
  // Job submission info
  submissionId: number;
  jobTitle?: string;
  companyName?: string;
  jobUrl?: string;
}

export default function ContactsPage() {
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const [generatingMessages, setGeneratingMessages] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all contacts across all submissions
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["/api/contacts/all"],
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, updates }: { contactId: number; updates: any }) => {
      return await apiRequest(`/api/contacts/${contactId}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/all"] });
    },
  });

  // Generate message mutation
  const generateMessageMutation = useMutation({
    mutationFn: async ({ contactId, messageType, tone }: { contactId: number; messageType: string; tone: string }) => {
      return await apiRequest(`/api/contacts/${contactId}/generate-message`, "POST", { messageType, tone });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/all"] });
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
      return { variant: "default" as const, className: "bg-green-100 text-green-800 border-green-200", text: "Valid", icon: "✓" };
    } else if (status === "risky" || status === "catchall") {
      return { variant: "outline" as const, className: "bg-yellow-50 text-yellow-700 border-yellow-300", text: "Risky", icon: "⚠" };
    } else if (status === "invalid") {
      return { variant: "destructive" as const, className: "bg-red-50 text-red-700 border-red-200", text: "Invalid", icon: "✗" };
    } else {
      return { variant: "secondary" as const, className: "bg-gray-50 text-gray-600 border-gray-200", text: "Unknown", icon: "?" };
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return { variant: "default" as const, className: "bg-green-50 text-green-700 border-green-200", text: "High" };
    } else if (confidence >= 70) {
      return { variant: "outline" as const, className: "bg-yellow-50 text-yellow-600 border-yellow-300", text: "Medium" };
    } else {
      return { variant: "secondary" as const, className: "bg-gray-50 text-gray-600 border-gray-200", text: "Low" };
    }
  };

  const getContactTypeBadge = (contact: Contact) => {
    if (contact.isRecruiterRole) {
      return { variant: "default" as const, className: "bg-blue-50 text-blue-700 border-blue-200", text: "Recruiter" };
    } else {
      const title = contact.title.toLowerCase();
      if (title.includes("manager") || title.includes("director") || title.includes("head")) {
        return { variant: "outline" as const, className: "bg-purple-50 text-purple-700 border-purple-200", text: "Hiring Manager" };
      } else {
        return { variant: "secondary" as const, className: "bg-gray-50 text-gray-600 border-gray-200", text: "Other" };
      }
    }
  };

  // Filter contacts based on search term
  const filteredContacts = contacts.filter((contact: Contact) =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">All Contacts</h1>
            <p className="text-gray-600 mt-2">
              Manage all your recruiter and hiring manager contacts across all job searches
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{filteredContacts.length} contacts</span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span>{new Set(filteredContacts.map((c: Contact) => c.companyName)).size} companies</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts, companies, or job titles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1600px] table-fixed">
            {/* Table Header */}
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="w-[180px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide sticky left-0 bg-gray-50 z-20 border-r border-gray-200">
                  Name
                </th>
                <th className="w-[200px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide sticky left-[180px] bg-gray-50 z-20 border-r border-gray-200">
                  Title
                </th>
                <th className="w-[120px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Type
                </th>
                <th className="w-[120px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Department
                </th>
                <th className="w-[100px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Confidence
                </th>
                <th className="w-[220px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Email
                </th>
                <th className="w-[100px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Status
                </th>
                <th className="w-[200px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Job & Company
                </th>
                <th className="w-[100px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Source
                </th>
                <th className="w-[200px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Notes
                </th>
                <th className="w-[120px] px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-200">
              {filteredContacts.map((contact: Contact) => {
                const verificationBadge = getVerificationBadge(contact.verificationStatus, contact.emailVerified);
                const confidenceBadge = getConfidenceBadge(contact.confidence);
                const contactTypeBadge = getContactTypeBadge(contact);
                const isGenerating = generatingMessages.has(contact.id);
                const hasMessages = contact.emailDraft || contact.linkedinMessage;
                const isExpanded = expandedMessages.has(contact.id);

                return (
                  <>
                    {/* Main Row */}
                    <tr key={contact.id} className="hover:bg-blue-50/30 transition-all duration-200">
                      {/* Name - Sticky */}
                      <td className="px-4 py-4 sticky left-0 bg-white hover:bg-blue-50/30 z-10 border-r border-gray-200">
                        <div className="font-semibold text-gray-900 text-sm">{contact.name}</div>
                        {contact.linkedinUrl && (
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs text-blue-600 hover:text-blue-700 mt-1"
                            title="View LinkedIn Profile"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            LinkedIn
                          </a>
                        )}
                      </td>

                      {/* Title - Sticky */}
                      <td className="px-4 py-4 sticky left-[180px] bg-white hover:bg-blue-50/30 z-10 border-r border-gray-200">
                        <div className="font-medium text-gray-900 text-sm">{contact.title}</div>
                      </td>

                      {/* Contact Type */}
                      <td className="px-4 py-4">
                        <Badge variant={contactTypeBadge.variant} className={`text-xs px-2 py-1 ${contactTypeBadge.className}`}>
                          {contactTypeBadge.text}
                        </Badge>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-4">
                        <span className="text-gray-600 text-sm">{contact.department}</span>
                      </td>

                      {/* Confidence */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <Badge variant={confidenceBadge.variant} className={`text-xs px-2 py-0.5 ${confidenceBadge.className}`}>
                            {confidenceBadge.text}
                          </Badge>
                          <div className="text-xs text-gray-500 font-mono">{contact.confidence}%</div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-4">
                        {contact.email ? (
                          <button
                            onClick={() => copyToClipboard(contact.email, "Email")}
                            className="text-blue-600 hover:text-blue-700 font-mono bg-blue-50 px-2 py-1 rounded border hover:bg-blue-100 transition-colors w-full text-left truncate text-sm"
                            title={`Copy ${contact.email}`}
                          >
                            {contact.email}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm">No email</span>
                        )}
                      </td>

                      {/* Email Status */}
                      <td className="px-4 py-4">
                        <Badge variant={verificationBadge.variant} className={`text-xs px-2 py-0.5 ${verificationBadge.className}`}>
                          {verificationBadge.icon}
                        </Badge>
                      </td>

                      {/* Job & Company */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <Link href={`/submissions/${contact.submissionId}`}>
                            <div className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer font-medium truncate">
                              {contact.jobTitle || "Unknown Job"}
                            </div>
                          </Link>
                          <div className="text-xs text-gray-500">{contact.companyName || "Unknown Company"}</div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-4">
                        <div className="text-gray-600 capitalize text-sm">{contact.sourcePlatform}</div>
                        {contact.apolloId && (
                          <div className="text-xs text-gray-400">#{contact.apolloId}</div>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-4">
                        {editingNotes === contact.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={notesValue}
                              onChange={(e) => setNotesValue(e.target.value)}
                              placeholder="Add notes..."
                              className="min-h-[60px] text-xs resize-none w-full"
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
                          <div className="flex items-center gap-1">
                            <div className="text-xs text-gray-600 truncate flex-1">
                              {contact.notes ? (
                                <span className="bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-200">
                                  {contact.notes.length > 25 ? `${contact.notes.substring(0, 25)}...` : contact.notes}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">No notes</span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingNotes(contact.id);
                                setNotesValue(contact.notes || "");
                              }}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 flex-shrink-0"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {!hasMessages ? (
                            <Button
                              onClick={() => handleGenerateMessages(contact)}
                              disabled={isGenerating || !contact.email}
                              size="sm"
                              className="h-8 px-4 text-xs bg-green-600 hover:bg-green-700 text-white font-medium"
                              title="Generate outreach email and LinkedIn message"
                            >
                              {isGenerating ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                                  Generating...
                                </>
                              ) : (
                                "Generate"
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => toggleMessageView(contact.id)}
                              variant="outline"
                              size="sm"
                              className="h-8 px-4 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 font-medium"
                              title="View and edit generated messages"
                            >
                              {isExpanded ? "Hide Messages" : "View Messages"}
                            </Button>
                          )}
                          {hasMessages && !isExpanded && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full" title="Messages generated"></div>
                              <span className="text-xs text-gray-500">Ready</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Generated Messages Dropdown - Same as in ContactTable */}
                    {hasMessages && (
                      <tr className={isExpanded ? '' : 'hidden'}>
                        <td colSpan={11} className="px-4 py-6 bg-blue-50/30 border-t border-blue-200">
                          <div className="max-w-6xl mx-auto">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">Generated Outreach Messages</h3>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleGenerateMessages(contact)}
                                  disabled={isGenerating}
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 text-xs"
                                  title="Regenerate messages"
                                >
                                  {isGenerating ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600" />
                                  ) : (
                                    "Regenerate"
                                  )}
                                </Button>
                                <Button
                                  onClick={() => toggleMessageView(contact.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-3 text-xs"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {contact.emailDraft && (
                                <Card className="border-gray-200 shadow-sm">
                                  <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-gray-900">Email Draft</h4>
                                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                                          Ready to send
                                        </Badge>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyToClipboard(contact.emailDraft!, "Email draft")}
                                        className="h-8 px-3 text-xs hover:bg-blue-100"
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Copy
                                      </Button>
                                    </div>
                                    <Textarea
                                      value={contact.emailDraft}
                                      onChange={(e) => {
                                        updateContactMutation.mutate({
                                          contactId: contact.id,
                                          updates: { emailDraft: e.target.value }
                                        });
                                      }}
                                      className="min-h-[200px] text-sm resize-none border-gray-300 focus:border-blue-500"
                                      placeholder="Email content will appear here..."
                                    />
                                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                      <span>Click to edit • Auto-saves changes</span>
                                      <span>{contact.emailDraft.length} characters</span>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                              
                              {contact.linkedinMessage && (
                                <Card className="border-gray-200 shadow-sm">
                                  <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-gray-900">LinkedIn Message</h4>
                                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                                          Ready to send
                                        </Badge>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyToClipboard(contact.linkedinMessage!, "LinkedIn message")}
                                        className="h-8 px-3 text-xs hover:bg-blue-100"
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Copy
                                      </Button>
                                    </div>
                                    <Textarea
                                      value={contact.linkedinMessage}
                                      onChange={(e) => {
                                        updateContactMutation.mutate({
                                          contactId: contact.id,
                                          updates: { linkedinMessage: e.target.value }
                                        });
                                      }}
                                      className="min-h-[150px] text-sm resize-none border-gray-300 focus:border-blue-500"
                                      placeholder="LinkedIn message content will appear here..."
                                    />
                                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                      <span>Click to edit • Auto-saves changes</span>
                                      <span>{contact.linkedinMessage.length} characters</span>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredContacts.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No contacts found</p>
            {searchTerm && (
              <p className="text-sm text-gray-400 mt-1">
                Try adjusting your search criteria
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}