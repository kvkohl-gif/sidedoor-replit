import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, ExternalLink, Copy, Mail, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Contact {
  id: number;
  name: string;
  title: string;
  email: string;
  linkedinUrl?: string;
  confidence: number;
  department: string;
  emailVerified: boolean;
  verificationStatus: "valid" | "risky" | "invalid" | "unknown";
  sourcePlatform: string;
  apolloId?: string;
  isRecruiterRole: boolean;
  contactStatus?: "not_contacted" | "email_sent" | "replied" | "follow_up_needed";
  notes?: string;
  lastContacted?: string;
  influenceScore?: "high" | "medium" | "low";
  emailDraft?: string;
  linkedinMessage?: string;
}

interface ContactTableProps {
  contacts: Contact[];
  submissionId: number;
}

export default function ContactTable({ contacts, submissionId }: ContactTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingMessages, setEditingMessages] = useState<{ [key: number]: { email?: string; linkedin?: string } }>({});
  const [generatingMessage, setGeneratingMessage] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Utility functions
  const getSeniorityLevel = (title: string): "VP" | "Director" | "Manager" | "Senior" | "Individual" => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("vp") || lowerTitle.includes("vice president")) return "VP";
    if (lowerTitle.includes("director")) return "Director";
    if (lowerTitle.includes("manager") || lowerTitle.includes("head of")) return "Manager";
    if (lowerTitle.includes("senior") || lowerTitle.includes("sr.")) return "Senior";
    return "Individual";
  };

  const getInfluenceScore = (contact: Contact): "high" | "medium" | "low" => {
    if (contact.influenceScore) return contact.influenceScore;
    
    const seniority = getSeniorityLevel(contact.title);
    const isRecruiter = contact.isRecruiterRole;
    
    if (isRecruiter && (seniority === "VP" || seniority === "Director")) return "high";
    if (isRecruiter || seniority === "Manager") return "medium";
    return "low";
  };

  const getEmailStatusBadge = (contact: Contact) => {
    if (!contact.email) return <Badge variant="secondary">Not Found</Badge>;
    
    switch (contact.verificationStatus) {
      case "valid":
        return <Badge variant="default" className="bg-green-100 text-green-800">✅ Verified</Badge>;
      case "risky":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">⚠️ Risky</Badge>;
      case "invalid":
        return <Badge variant="destructive">❌ Invalid</Badge>;
      default:
        return <Badge variant="secondary">Unverified</Badge>;
    }
  };

  const getInfluenceScoreBadge = (score: "high" | "medium" | "low") => {
    switch (score) {
      case "high":
        return <Badge className="bg-red-100 text-red-800">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case "low":
        return <Badge className="bg-gray-100 text-gray-800">Low</Badge>;
    }
  };

  // Mutations
  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, updates }: { contactId: number; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/contacts/${contactId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions", submissionId, "contacts"] });
    },
  });

  const generateMessageMutation = useMutation({
    mutationFn: async ({ contactId, messageType, tone }: { contactId: number; messageType: "email" | "linkedin"; tone?: string }) => {
      const response = await apiRequest("POST", `/api/contacts/${contactId}/generate-message`, { messageType, tone });
      return response.json();
    },
    onSuccess: (data, variables) => {
      setEditingMessages(prev => ({
        ...prev,
        [variables.contactId]: {
          ...prev[variables.contactId],
          [variables.messageType]: data.message
        }
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", variables.contactId] });
    },
  });

  // Event handlers
  const handleExpandRow = (contactId: number) => {
    setExpandedRow(expandedRow === contactId ? null : contactId);
  };

  const handleStatusChange = (contactId: number, status: string) => {
    updateContactMutation.mutate({
      contactId,
      updates: { contactStatus: status }
    });
  };

  const handleNotesChange = (contactId: number, notes: string) => {
    updateContactMutation.mutate({
      contactId,
      updates: { notes }
    });
  };

  const handleGenerateMessage = async (contactId: number, messageType: "email" | "linkedin", tone?: string) => {
    setGeneratingMessage(contactId);
    try {
      await generateMessageMutation.mutateAsync({ contactId, messageType, tone });
    } finally {
      setGeneratingMessage(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Message copied successfully",
    });
  };

  const openInGmail = (email: string, subject: string, body: string) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  // Sort contacts by influence score and recruiter role
  const sortedContacts = [...contacts].sort((a, b) => {
    const aInfluence = getInfluenceScore(a);
    const bInfluence = getInfluenceScore(b);
    const aScore = a.isRecruiterRole ? 3 : 0 + (aInfluence === "high" ? 2 : aInfluence === "medium" ? 1 : 0);
    const bScore = b.isRecruiterRole ? 3 : 0 + (bInfluence === "high" ? 2 : bInfluence === "medium" ? 1 : 0);
    return bScore - aScore;
  });

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-white">
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Seniority</TableHead>
              <TableHead>Email Status</TableHead>
              <TableHead className="w-12">LinkedIn</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Influence</TableHead>
              <TableHead>Next Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedContacts.map((contact) => (
              <Collapsible key={contact.id} open={expandedRow === contact.id} onOpenChange={() => handleExpandRow(contact.id)}>
                <CollapsibleTrigger asChild>
                  <TableRow className="cursor-pointer hover:bg-gray-50">
                    <TableCell>
                      {expandedRow === contact.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.title}</TableCell>
                    <TableCell>{contact.department}</TableCell>
                    <TableCell>{getSeniorityLevel(contact.title)}</TableCell>
                    <TableCell>{getEmailStatusBadge(contact)}</TableCell>
                    <TableCell>
                      {contact.linkedinUrl && (
                        <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 text-blue-600 hover:text-blue-800" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={contact.contactStatus || "not_contacted"}
                        onValueChange={(value) => handleStatusChange(contact.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_contacted">Not Contacted</SelectItem>
                          <SelectItem value="email_sent">Email Sent</SelectItem>
                          <SelectItem value="replied">Replied</SelectItem>
                          <SelectItem value="follow_up_needed">Follow-Up Needed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{getInfluenceScoreBadge(getInfluenceScore(contact))}</TableCell>
                    <TableCell>
                      <Input
                        placeholder="Add note..."
                        defaultValue={contact.notes || ""}
                        onBlur={(e) => handleNotesChange(contact.id, e.target.value)}
                        className="w-32"
                      />
                    </TableCell>
                  </TableRow>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                  <TableRow>
                    <TableCell colSpan={10} className="p-0">
                      <div className="p-6 bg-gray-50 border-t">
                        {/* Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div>
                            <h4 className="font-semibold text-gray-900">Contact Information</h4>
                            <p className="text-sm text-gray-600">{contact.name}</p>
                            <p className="text-sm text-gray-600">{contact.title}</p>
                            <p className="text-sm text-gray-600">{contact.department} • {getSeniorityLevel(contact.title)}</p>
                            {contact.email && (
                              <p className="text-sm text-gray-600 flex items-center gap-2">
                                {contact.email} {getEmailStatusBadge(contact)}
                              </p>
                            )}
                            {contact.linkedinUrl && (
                              <a 
                                href={contact.linkedinUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              >
                                LinkedIn Profile <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Message Generator */}
                        {contact.email && (
                          <div className="space-y-4">
                            <h4 className="font-semibold text-gray-900">Generated Messages</h4>
                            
                            {/* Email Message */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">Email Message</label>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleGenerateMessage(contact.id, "email")}
                                    disabled={generatingMessage === contact.id}
                                  >
                                    {generatingMessage === contact.id ? (
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-3 w-3" />
                                    )}
                                    Regenerate
                                  </Button>
                                </div>
                              </div>
                              <Textarea
                                value={editingMessages[contact.id]?.email || contact.emailDraft || ""}
                                onChange={(e) => setEditingMessages(prev => ({
                                  ...prev,
                                  [contact.id]: { ...prev[contact.id], email: e.target.value }
                                }))}
                                placeholder="Generated email message will appear here..."
                                className="min-h-[120px]"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyToClipboard(editingMessages[contact.id]?.email || contact.emailDraft || "")}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openInGmail(
                                    contact.email,
                                    "Re: Your Recent Job Opening",
                                    editingMessages[contact.id]?.email || contact.emailDraft || ""
                                  )}
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  Open in Gmail
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleStatusChange(contact.id, "email_sent")}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Mark as Sent
                                </Button>
                              </div>
                            </div>

                            {/* LinkedIn Message */}
                            {contact.linkedinUrl && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium text-gray-700">LinkedIn Message</label>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleGenerateMessage(contact.id, "linkedin")}
                                    disabled={generatingMessage === contact.id}
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Regenerate
                                  </Button>
                                </div>
                                <Textarea
                                  value={editingMessages[contact.id]?.linkedin || contact.linkedinMessage || ""}
                                  onChange={(e) => setEditingMessages(prev => ({
                                    ...prev,
                                    [contact.id]: { ...prev[contact.id], linkedin: e.target.value }
                                  }))}
                                  placeholder="Generated LinkedIn message will appear here..."
                                  className="min-h-[100px]"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(editingMessages[contact.id]?.linkedin || contact.linkedinMessage || "")}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleStatusChange(contact.id, "email_sent")}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Mark as Sent
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Notes & Activity */}
                        <div className="mt-6 space-y-2">
                          <label className="text-sm font-medium text-gray-700">Notes & Activity</label>
                          {contact.lastContacted && (
                            <p className="text-xs text-gray-500">Last contacted on {contact.lastContacted}</p>
                          )}
                          <Textarea
                            placeholder="Add notes about this contact..."
                            defaultValue={contact.notes || ""}
                            onBlur={(e) => handleNotesChange(contact.id, e.target.value)}
                            className="min-h-[60px]"
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </TableBody>
        </Table>
      </div>

      {sortedContacts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No recruiter contacts found yet.</p>
          <p className="text-sm">Try expanding search parameters or adding more departments.</p>
        </div>
      )}
    </div>
  );
}