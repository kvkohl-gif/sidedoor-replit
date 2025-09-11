import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Mail, 
  ExternalLink, 
  Zap, 
  Copy, 
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ContactCardsProps {
  contacts: any[];
  submissionId?: number;
}

export default function ContactCards({ contacts, submissionId }: ContactCardsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Local state
  const [generatingMessages, setGeneratingMessages] = useState<Set<number>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");

  // Helper functions
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: `${type} copied to clipboard` });
    } catch (err) {
      toast({ title: "Failed to copy", description: "Could not copy to clipboard", variant: "destructive" });
    }
  };

  const getVerificationBadge = (status?: string) => {
    switch (status) {
      case 'valid':
        return {
          text: '✅ Valid',
          variant: 'default' as const,
          className: 'bg-green-50 text-green-700 border-green-200',
          description: 'The email has been verified and can receive mail.'
        };
      case 'risky':
      case 'catchall':
        return {
          text: '⚠️ Risky',
          variant: 'outline' as const,
          className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
          description: 'The email may work but is flagged as unreliable.'
        };
      case 'invalid':
        return {
          text: '❌ Invalid',
          variant: 'destructive' as const,
          className: 'bg-red-50 text-red-700 border-red-200',
          description: 'The email is invalid or will bounce.'
        };
      default:
        return {
          text: '❓ Unknown',
          variant: 'secondary' as const,
          className: 'bg-gray-50 text-gray-700 border-gray-200',
          description: 'The email could not be verified.'
        };
    }
  };

  // Generate messages mutation
  const generateMessageMutation = useMutation({
    mutationFn: async ({ contactId, messageType, tone }: { contactId: number; messageType: string; tone?: string }) => {
      return await apiRequest("POST", `/api/contacts/${contactId}/generate-message`, { messageType, tone });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/submissions/${submissionId}`] });
    },
    onError: (error, variables) => {
      setGeneratingMessages(prev => {
        const next = new Set(Array.from(prev));
        next.delete(variables.contactId);
        return next;
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, notes }: { contactId: number; notes: string }) => {
      return await apiRequest("PATCH", `/api/contacts/${contactId}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/submissions/${submissionId}`] });
      setEditingNotes(null);
      setNotesValue("");
      toast({ title: "Notes saved", description: "Contact notes have been updated" });
    },
  });

  const handleGenerateMessages = async (contact: any) => {
    setGeneratingMessages(prev => new Set(Array.from(prev).concat([contact.id])));
    
    try {
      // Generate both email and LinkedIn messages sequentially
      await generateMessageMutation.mutateAsync({
        contactId: contact.id,
        messageType: 'email',
      });
      
      await generateMessageMutation.mutateAsync({
        contactId: contact.id,
        messageType: 'linkedin',
      });
      
      // Auto-expand the card to show messages
      setExpandedCards(prev => {
        const next = new Set(Array.from(prev));
        next.add(contact.id);
        return next;
      });
      
      toast({
        title: "Messages Generated",
        description: "Both email and LinkedIn messages have been created",
      });
      
    } catch (error) {
      console.error('Error generating messages:', error);
      toast({
        title: "Error",
        description: "Failed to generate messages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingMessages(prev => {
        const next = new Set(Array.from(prev));
        next.delete(contact.id);
        return next;
      });
    }
  };

  const toggleCardExpansion = (contactId: number) => {
    setExpandedCards(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const handleSaveNotes = (contact: any) => {
    updateContactMutation.mutate({
      contactId: contact.id,
      notes: notesValue,
    });
  };

  if (!contacts || contacts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No contacts found for this submission.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {contacts.map((contact) => {
          const isGenerating = generatingMessages.has(contact.id);
          const isExpanded = expandedCards.has(contact.id);
          const hasMessages = contact.generatedEmailMessage || contact.generatedLinkedInMessage || contact.emailDraft || contact.linkedinMessage;
          const verificationBadge = getVerificationBadge(contact.verificationStatus);

        return (
          <Card key={contact.id} className="border-gray-200 hover:shadow-md transition-all duration-200 p-6">
            {/* Header with name, title and badges */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">
                  {contact.name}
                </h3>
                <p className="text-gray-600 mb-3">
                  {contact.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 cursor-help">
                      {Math.round((contact.recruiterConfidence || contact.confidenceScore || 0) * 100)}% confidence
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>AI confidence score for recruiter identification</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Contact information */}
            <div className="space-y-3 mb-6">
              {/* Email */}
              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Mail className="h-5 w-5 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click email to copy to clipboard</p>
                  </TooltipContent>
                </Tooltip>
                {contact.email ? (
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => copyToClipboard(contact.email, "Email")}
                          className="text-gray-600 hover:text-blue-600 transition-colors"
                        >
                          {contact.email}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy email address to clipboard</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Copy className="h-4 w-4 text-gray-400 hover:text-blue-600 cursor-pointer" 
                              onClick={() => copyToClipboard(contact.email, "Email")} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy email address</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={verificationBadge.variant} className={`${verificationBadge.className} cursor-help ml-2`}>
                          {verificationBadge.text.includes('⚠️') ? '⚠️ Risky' : verificationBadge.text}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{verificationBadge.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">email_not_unlocked@domain.com</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="bg-gray-50 text-gray-600 border-gray-200 cursor-help ml-2">
                          ❓ Unknown
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>The email could not be verified.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* LinkedIn */}
              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="h-5 w-5 bg-blue-600 rounded flex items-center justify-center cursor-help">
                      <span className="text-white text-xs font-bold">in</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>LinkedIn profile connection</p>
                  </TooltipContent>
                </Tooltip>
                {contact.linkedinUrl ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        LinkedIn Profile
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View full LinkedIn profile to learn more or connect</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-gray-400">LinkedIn Profile</span>
                )}
              </div>
            </div>

            {/* Name and title repeat for generate messages section */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{contact.name}</h4>
                <p className="text-sm text-gray-600">{contact.title}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => handleGenerateMessages(contact)}
                    disabled={isGenerating}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
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
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create personalized email and LinkedIn messages for this contact</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Expandable messages section - auto-expand when messages are generated */}
            {hasMessages && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Generated Messages</span>
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
                        Show
                      </>
                    )}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="space-y-4">
                    {(contact.generatedEmailMessage || contact.emailDraft) && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-blue-900">Email Message</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(contact.generatedEmailMessage || contact.emailDraft, "Email message")}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <div className="text-sm text-blue-800 whitespace-pre-wrap">
                          {contact.generatedEmailMessage || contact.emailDraft}
                        </div>
                      </div>
                    )}

                    {(contact.generatedLinkedInMessage || contact.linkedinMessage) && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-blue-900">LinkedIn Message</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(contact.generatedLinkedInMessage || contact.linkedinMessage, "LinkedIn message")}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <div className="text-sm text-blue-800 whitespace-pre-wrap">
                          {contact.generatedLinkedInMessage || contact.linkedinMessage}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes section */}
            {(isExpanded || hasMessages) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
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
            )}
          </Card>
        );
        })}
      </div>
    </TooltipProvider>
  );
}