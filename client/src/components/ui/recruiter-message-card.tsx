import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Mail, MessageCircle, Edit, Save, Check, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { RecruiterContact, MessageTemplate } from "@shared/schema";

interface RecruiterMessageCardProps {
  recruiter: RecruiterContact;
}

export function RecruiterMessageCard({ recruiter }: RecruiterMessageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingLinkedin, setEditingLinkedin] = useState(false);
  const [emailContent, setEmailContent] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [linkedinContent, setLinkedinContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for existing messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery<MessageTemplate[]>({
    queryKey: [`/api/recruiters/${recruiter.id}/messages`],
    enabled: isExpanded,
    retry: false,
  });

  // Generate messages mutation
  const generateMessagesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/recruiters/${recruiter.id}/generate-messages`, {});
      return response.json();
    },
    onSuccess: (data) => {
      setEmailSubject(data.email.subject);
      setEmailContent(data.email.content);
      setLinkedinContent(data.linkedin.content);
      queryClient.invalidateQueries({ queryKey: [`/api/recruiters/${recruiter.id}/messages`] });
      toast({
        title: "Messages generated!",
        description: "Personalized email and LinkedIn messages have been created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate messages",
        variant: "destructive",
      });
    },
  });

  // Update message mutation
  const updateMessageMutation = useMutation({
    mutationFn: async ({ messageId, updates }: { messageId: number; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/messages/${messageId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/recruiters/${recruiter.id}/messages`] });
      toast({
        title: "Message updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update message",
        variant: "destructive",
      });
    },
  });

  // Find latest messages
  const emailMessage = messages.find(m => m.messageType === "email");
  const linkedinMessage = messages.find(m => m.messageType === "linkedin");

  // Initialize content when messages load
  if (emailMessage && !emailContent) {
    setEmailContent(emailMessage.content);
    setEmailSubject(emailMessage.subject || "");
  }
  if (linkedinMessage && !linkedinContent) {
    setLinkedinContent(linkedinMessage.content);
  }

  const handleGenerateMessages = () => {
    generateMessagesMutation.mutate();
  };

  const handleSaveEmail = () => {
    if (emailMessage) {
      updateMessageMutation.mutate({
        messageId: emailMessage.id,
        updates: { subject: emailSubject, content: emailContent }
      });
    }
    setEditingEmail(false);
  };

  const handleSaveLinkedin = () => {
    if (linkedinMessage) {
      updateMessageMutation.mutate({
        messageId: linkedinMessage.id,
        updates: { content: linkedinContent }
      });
    }
    setEditingLinkedin(false);
  };

  const handleMarkEmailSent = () => {
    if (emailMessage) {
      updateMessageMutation.mutate({
        messageId: emailMessage.id,
        updates: { 
          isSent: "true", 
          sentAt: new Date().toISOString() 
        }
      });
    }
  };

  const handleMarkLinkedinSent = () => {
    if (linkedinMessage) {
      updateMessageMutation.mutate({
        messageId: linkedinMessage.id,
        updates: { 
          isSent: "true", 
          sentAt: new Date().toISOString() 
        }
      });
    }
  };

  const hasMessages = emailMessage || linkedinMessage;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="space-y-4">
        {/* Main recruiter info with expand button */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-slate-900">{recruiter.name || "Unknown Contact"}</h4>
            <p className="text-sm text-slate-600">{recruiter.title || "No title"}</p>
          </div>
          
          <div className="flex items-center space-x-2">
            {hasMessages ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit Messages
                {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </Button>
            ) : (
              <Button 
                size="sm"
                onClick={handleGenerateMessages}
                disabled={generateMessagesMutation.isPending}
              >
                {generateMessagesMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4 mr-1" />
                )}
                Generate Messages
              </Button>
            )}
          </div>
        </div>

        {/* Expanded message editing area */}
        <CollapsibleContent>
          {messagesLoading && (
            <div className="text-center py-4">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-600">Loading messages...</p>
            </div>
          )}

          {!messagesLoading && hasMessages && (
            <Card>
              <CardContent className="p-6 space-y-6">
                {/* Email Section */}
                {emailMessage && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-5 h-5 text-blue-600" />
                        <h5 className="font-medium">Email Message</h5>
                        {emailMessage.isSent === "true" && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <Check className="w-3 h-3 mr-1" />
                            Sent {emailMessage.sentAt ? new Date(emailMessage.sentAt).toLocaleDateString() : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {editingEmail ? (
                          <Button size="sm" onClick={handleSaveEmail}>
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setEditingEmail(true)}>
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )}
                        {emailMessage.isSent !== "true" && !editingEmail && (
                          <Button size="sm" variant="default" onClick={handleMarkEmailSent}>
                            <Check className="w-4 h-4 mr-1" />
                            Mark as Sent
                          </Button>
                        )}
                      </div>
                    </div>

                    {editingEmail ? (
                      <div className="space-y-3">
                        <Input
                          placeholder="Email subject"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                        />
                        <Textarea
                          placeholder="Email content"
                          value={emailContent}
                          onChange={(e) => setEmailContent(e.target.value)}
                          className="min-h-[120px]"
                        />
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                        <p className="font-medium text-sm text-slate-700">Subject: {emailSubject}</p>
                        <div className="text-sm text-slate-700 whitespace-pre-line">
                          {emailContent}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* LinkedIn Section */}
                {linkedinMessage && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="w-5 h-5 text-blue-600" />
                        <h5 className="font-medium">LinkedIn Message</h5>
                        {linkedinMessage.isSent === "true" && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <Check className="w-3 h-3 mr-1" />
                            Sent {linkedinMessage.sentAt ? new Date(linkedinMessage.sentAt).toLocaleDateString() : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {editingLinkedin ? (
                          <Button size="sm" onClick={handleSaveLinkedin}>
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setEditingLinkedin(true)}>
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )}
                        {linkedinMessage.isSent !== "true" && !editingLinkedin && (
                          <Button size="sm" variant="default" onClick={handleMarkLinkedinSent}>
                            <Check className="w-4 h-4 mr-1" />
                            Mark as Sent
                          </Button>
                        )}
                      </div>
                    </div>

                    {editingLinkedin ? (
                      <Textarea
                        placeholder="LinkedIn message content"
                        value={linkedinContent}
                        onChange={(e) => setLinkedinContent(e.target.value)}
                        className="min-h-[100px]"
                      />
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-sm text-slate-700 whitespace-pre-line">
                          {linkedinContent}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}