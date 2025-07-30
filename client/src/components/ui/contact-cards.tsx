import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  Mail,
  User,
  Building,
  MapPin,
  Shield,
  Target,
  Globe,
  X,
  Edit3,
  Save
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContactCardsProps {
  contacts: any[];
  submissionId: number;
}

export default function ContactCards({ contacts, submissionId }: ContactCardsProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [generatingMessages, setGeneratingMessages] = useState<Set<number>>(new Set());
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, updates }: { contactId: number; updates: any }) => {
      return await apiRequest("PATCH", `/api/contacts/${contactId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/submissions/${submissionId}`] });
    },
  });

  // Generate message mutation
  const generateMessageMutation = useMutation({
    mutationFn: async ({ contactId, messageType, tone }: { contactId: number; messageType: string; tone: string }) => {
      return await apiRequest("POST", `/api/contacts/${contactId}/generate-message`, { messageType, tone });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/submissions/${submissionId}`] });
      setGeneratingMessages(prev => {
        const next = new Set([...prev]);
        next.delete(variables.contactId);
        return next;
      });
      setExpandedCards(prev => {
        const next = new Set([...prev]);
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
        const next = new Set([...prev]);
        next.delete(variables.contactId);
        return next;
      });
    },
  });

  const toggleCardExpansion = (contactId: number) => {
    setExpandedCards(prev => {
      const next = new Set([...prev]);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const handleGenerateMessages = (contact: any) => {
    setGeneratingMessages(prev => new Set([...Array.from(prev), contact.id]));
    generateMessageMutation.mutate({
      contactId: contact.id,
      messageType: 'email',
      tone: 'professional',
    });
  };

  const handleSaveNotes = (contact: any) => {
    updateContactMutation.mutate({
      contactId: contact.id,
      updates: { notes: notesValue },
    });
    setEditingNotes(null);
    setNotesValue("");
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
      return { variant: "default" as const, className: "bg-green-100 text-green-800 border-green-200", text: "✅ Valid", description: "Email verified and deliverable" };
    } else if (status === "risky" || status === "catchall") {
      return { variant: "outline" as const, className: "bg-yellow-50 text-yellow-700 border-yellow-300", text: "⚠️ Risky", description: "Email may be risky or catch-all" };
    } else if (status === "invalid") {
      return { variant: "destructive" as const, className: "bg-red-50 text-red-700 border-red-200", text: "❌ Invalid", description: "Email is invalid or undeliverable" };
    } else {
      return { variant: "secondary" as const, className: "bg-gray-50 text-gray-600 border-gray-200", text: "❓ Unknown", description: "Email verification status unknown" };
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    const conf = confidence || 0;
    if (conf >= 90) {
      return { variant: "default" as const, className: "bg-green-50 text-green-700 border-green-200", text: "High", description: `${conf}% - Very likely to be accurate` };
    } else if (conf >= 70) {
      return { variant: "outline" as const, className: "bg-yellow-50 text-yellow-600 border-yellow-300", text: "Medium", description: `${conf}% - Moderately confident` };
    } else {
      return { variant: "secondary" as const, className: "bg-gray-50 text-gray-600 border-gray-200", text: "Low", description: `${conf}% - Lower confidence level` };
    }
  };

  const getContactTypeBadge = (contact: any) => {
    if (contact.isRecruiterRole) {
      return { variant: "default" as const, className: "bg-blue-50 text-blue-700 border-blue-200", text: "👤 Recruiter" };
    } else {
      const title = contact.title.toLowerCase();
      if (title.includes("manager") || title.includes("director") || title.includes("head")) {
        return { variant: "outline" as const, className: "bg-purple-50 text-purple-700 border-purple-200", text: "🎯 Hiring Manager" };
      } else {
        return { variant: "secondary" as const, className: "bg-gray-50 text-gray-600 border-gray-200", text: "👔 Other" };
      }
    }
  };

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>No contacts found for this job submission</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {contacts.map((contact) => {
          const isExpanded = expandedCards.has(contact.id);
          const isGenerating = generatingMessages.has(contact.id);
          const hasMessages = contact.emailDraft || contact.linkedinMessage;
          const verificationBadge = getVerificationBadge(contact.verificationStatus, contact.emailVerified);
          const confidenceBadge = getConfidenceBadge(contact.recruiterConfidence || contact.confidenceScore);
          const contactTypeBadge = getContactTypeBadge(contact);

          return (
            <Card key={contact.id} className="border-gray-200 hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg font-semibold text-gray-900">
                        {contact.name}
                      </CardTitle>
                      <Badge variant={contactTypeBadge.variant} className={`text-xs px-2 py-0.5 ${contactTypeBadge.className}`}>
                        {contactTypeBadge.text}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1" title={contact.title}>
                      {contact.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={confidenceBadge.variant} className={`text-xs px-2 py-0.5 ${confidenceBadge.className} cursor-help`}>
                          {confidenceBadge.text}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{confidenceBadge.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Contact Details Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {/* Email */}
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    {contact.email ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                          onClick={() => copyToClipboard(contact.email, "Email")}
                          className="text-blue-600 hover:text-blue-700 font-mono text-sm bg-blue-50 px-2 py-1 rounded border hover:bg-blue-100 transition-colors truncate flex-1 text-left"
                          title={`Copy ${contact.email}`}
                        >
                          {contact.email}
                        </button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant={verificationBadge.variant} className={`text-xs px-2 py-0.5 ${verificationBadge.className} cursor-help`}>
                              {verificationBadge.text.split(' ')[0]}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{verificationBadge.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No email available</span>
                    )}
                  </div>

                  {/* LinkedIn */}
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    {contact.linkedinUrl ? (
                      <a
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 truncate"
                      >
                        <span>LinkedIn Profile</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">No LinkedIn</span>
                    )}
                  </div>

                  {/* Source */}
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600 text-sm capitalize">{contact.sourcePlatform || 'Apollo'}</span>
                    {contact.apolloId && (
                      <span className="text-xs text-gray-400">#{contact.apolloId}</span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Action Button */}
                <div className="flex justify-between items-center mb-4">
                  <Button
                    onClick={() => handleGenerateMessages(contact)}
                    disabled={isGenerating}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Generate Messages
                      </>
                    )}
                  </Button>
                </div>

                {/* Notes Section */}
                <div className="mb-4">
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
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        {contact.notes ? (
                          <div className="bg-amber-50 text-amber-800 px-3 py-2 rounded border border-amber-200 text-sm">
                            {contact.notes}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm italic">No notes added</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingNotes(contact.id);
                          setNotesValue(contact.notes || "");
                        }}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                        title="Edit notes"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  {!hasMessages ? (
                    <Button
                      onClick={() => handleGenerateMessages(contact)}
                      disabled={isGenerating || !contact.email}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      {isGenerating ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap className="h-3 w-3 mr-2" />
                          Generate Messages
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Messages Ready</span>
                      </div>
                    </div>
                  )}

                  {hasMessages && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCardExpansion(contact.id)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          View
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Expanded Messages */}
                {hasMessages && isExpanded && (
                  <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                    {contact.emailDraft && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 text-sm">Email Draft</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(contact.emailDraft, "Email draft")}
                            className="h-7 px-2 text-xs"
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
                          className="min-h-[120px] text-sm resize-none"
                          placeholder="Email content will appear here..."
                        />
                        <div className="mt-1 text-xs text-gray-500">
                          {contact.emailDraft.length} characters • Click to edit
                        </div>
                      </div>
                    )}

                    {contact.linkedinMessage && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 text-sm">LinkedIn Message</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(contact.linkedinMessage, "LinkedIn message")}
                            className="h-7 px-2 text-xs"
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
                          className="min-h-[80px] text-sm resize-none"
                          placeholder="LinkedIn message will appear here..."
                        />
                        <div className="mt-1 text-xs text-gray-500">
                          {contact.linkedinMessage.length} characters • Click to edit
                        </div>
                      </div>
                    )}

                    <div className="flex justify-center">
                      <Button
                        onClick={() => handleGenerateMessages(contact)}
                        disabled={isGenerating}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                      >
                        {isGenerating ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600" />
                        ) : (
                          "Regenerate Messages"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}