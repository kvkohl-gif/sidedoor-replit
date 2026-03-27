import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import {
  MessageCircle,
  Users,
  Clock,
  Send,
  Mail,
  Linkedin,
  CheckCircle2,
  Calendar,
  ChevronRight,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface OutreachHubProps {
  onNavigate: (page: string, data?: any) => void;
}

// Pipeline stage definitions
const PIPELINE_STAGES = [
  { key: "not_contacted", label: "Not Contacted", icon: Users, color: "#94A3B8" },
  { key: "reached_out", label: "Reached Out", icon: Send, color: "#6B46C1" },
  { key: "awaiting_reply", label: "Awaiting Reply", icon: Clock, color: "#D97706" },
  { key: "replied", label: "Replied", icon: CheckCircle2, color: "#059669" },
  { key: "interview", label: "Interview", icon: Calendar, color: "#10B981" },
] as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function OutreachHub({ onNavigate }: OutreachHubProps) {
  const queryClient = useQueryClient();

  // Fetch pipeline counts
  const { data: pipeline, isLoading: pipelineLoading } = useQuery<Record<string, number>>({
    queryKey: ["/api/outreach/pipeline"],
  });

  // Fetch follow-ups due
  const { data: followUpsData, isLoading: followUpsLoading } = useQuery<{ contacts: any[] }>({
    queryKey: ["/api/outreach/follow-ups"],
  });

  // Fetch all contacts for the contact list
  const { data: allContacts = [], isLoading: contactsLoading } = useQuery<any[]>({
    queryKey: ["/api/contacts/all"],
  });

  const isLoading = pipelineLoading || followUpsLoading || contactsLoading;

  // Log activity mutation
  const logActivityMutation = useMutation({
    mutationFn: async (data: { contactId: number; activityType: string; channel?: string; notes?: string }) => {
      const res = await apiRequest("POST", "/api/outreach/activities", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/all"] });
    },
  });

  const followUps = followUpsData?.contacts ?? [];

  // Contacts grouped by status for the main list
  const contactsByStatus = allContacts.reduce((acc: Record<string, any[]>, contact: any) => {
    const status = contact.contactStatus || "not_contacted";
    let bucket = "not_contacted";
    if (status === "email_sent" || status === "linkedin_sent") bucket = "reached_out";
    else if (status === "awaiting_reply" || status === "follow_up_needed") bucket = "awaiting_reply";
    else if (status === "replied") bucket = "replied";
    else if (status === "interview_scheduled") bucket = "interview";
    if (!acc[bucket]) acc[bucket] = [];
    acc[bucket].push(contact);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#6B46C1] animate-spin mx-auto mb-4" />
          <p className="text-[#64748B]">Loading outreach hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-[1400px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#0F172A] mb-1.5">Outreach Hub</h1>
        <p className="text-[#64748B] text-[15px]">
          Track your outreach pipeline and manage follow-ups
        </p>
      </div>

      {/* Pipeline Overview */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-4">Pipeline</h2>
        <div className="flex items-center gap-0">
          {PIPELINE_STAGES.map((stage, i) => {
            const count = pipeline?.[stage.key] ?? 0;
            const Icon = stage.icon;
            const isLast = i === PIPELINE_STAGES.length - 1;
            return (
              <div key={stage.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${stage.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: stage.color }} />
                  </div>
                  <span className="text-2xl font-bold text-[#0F172A]">{count}</span>
                  <span className="text-xs text-[#64748B] font-medium text-center">{stage.label}</span>
                </div>
                {!isLast && (
                  <div className="flex-shrink-0 mx-1">
                    <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Follow-ups Due */}
      {followUps.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h2 className="text-[#0F172A] font-semibold text-sm">Follow-ups Due ({followUps.length})</h2>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {followUps.slice(0, 10).map((contact: any) => {
              const days = contact.last_contacted_at ? daysSince(contact.last_contacted_at) : 0;
              const company = contact.job_submissions?.company_name || "";
              return (
                <div
                  key={contact.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-[#FAFBFC] transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">
                        {contact.full_name || contact.name}
                      </p>
                      <p className="text-xs text-[#64748B] truncate">
                        {contact.title}{company ? ` at ${company}` : ""}
                        {" — "}
                        <span className="text-amber-600 font-medium">{days} days since last contact</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <button
                      onClick={() => logActivityMutation.mutate({
                        contactId: contact.id,
                        activityType: "follow_up_sent",
                        channel: "email",
                      })}
                      disabled={logActivityMutation.isPending}
                      className="px-3 py-1.5 text-xs font-medium text-[#6B46C1] bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                      title="Log email follow-up"
                    >
                      <Mail className="w-3.5 h-3.5 inline mr-1" />
                      Follow up
                    </button>
                    <button
                      onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                      className="p-1.5 text-[#94A3B8] hover:text-[#6B46C1] transition-colors"
                      title="View contact"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contact List by Pipeline Stage */}
      <div className="space-y-4">
        {PIPELINE_STAGES.map((stage) => {
          const contacts = contactsByStatus[stage.key] ?? [];
          if (contacts.length === 0) return null;
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: stage.color }} />
                <h2 className="text-[#0F172A] font-semibold text-sm">
                  {stage.label} ({contacts.length})
                </h2>
              </div>
              <div className="divide-y divide-[#F1F5F9]">
                {contacts.slice(0, 8).map((contact: any) => (
                  <button
                    key={contact.id}
                    onClick={() => onNavigate("contact-detail", { contactId: contact.id })}
                    className="w-full px-6 py-3 flex items-center justify-between hover:bg-[#FAFBFC] transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#0F172A] truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-[#64748B] truncate">
                        {contact.title}{contact.companyName ? ` at ${contact.companyName}` : ""}
                      </p>
                    </div>
                    {contact.createdAt && (
                      <span className="text-[11px] text-[#94A3B8] flex-shrink-0 ml-4">
                        {timeAgo(contact.createdAt)}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#CBD5E1] flex-shrink-0 ml-2" />
                  </button>
                ))}
                {contacts.length > 8 && (
                  <div className="px-6 py-3 text-center">
                    <button
                      onClick={() => onNavigate("contacts")}
                      className="text-xs font-medium text-[#6B46C1] hover:text-[#5a3ba1]"
                    >
                      View all {contacts.length} contacts
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {allContacts.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-10 text-center">
          <MessageCircle className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
          <h3 className="text-[#0F172A] font-medium mb-1">No outreach yet</h3>
          <p className="text-[#64748B] text-sm mb-5">
            Start by searching for a job to find contacts you can reach out to.
          </p>
          <button
            onClick={() => onNavigate("search")}
            className="px-4 py-2 bg-[#6B46C1] text-white rounded-lg hover:bg-[#5a3ba1] transition-colors inline-flex items-center gap-2 text-sm"
          >
            Start New Search
          </button>
        </div>
      )}
    </div>
  );
}
