import { supabaseAdmin } from "../lib/supabaseClient";

interface LogActivityData {
  userId: string;
  contactId: number;
  submissionId?: number;
  activityType: string;
  channel?: string;
  messageContent?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Add the specified number of business days to a date, skipping weekends.
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

const OUTREACH_ACTIVITY_TYPES = new Set([
  "email_sent",
  "linkedin_sent",
  "follow_up_sent",
]);

/**
 * Log an outreach activity and update the associated contact record.
 */
export async function logActivity(data: LogActivityData) {
  const {
    userId,
    contactId,
    submissionId,
    activityType,
    channel,
    messageContent,
    notes,
    metadata,
  } = data;

  // Insert the activity record
  const { data: activity, error: insertError } = await supabaseAdmin
    .from("outreach_activities")
    .insert({
      user_id: userId,
      recruiter_contact_id: contactId,
      job_submission_id: submissionId ?? null,
      activity_type: activityType,
      channel: channel ?? null,
      message_content: messageContent ?? null,
      notes: notes ?? null,
      metadata: metadata ?? null,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to log activity: ${insertError.message}`);
  }

  // Always update last_activity_at
  const contactUpdate: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
  };

  if (OUTREACH_ACTIVITY_TYPES.has(activityType)) {
    // Determine the appropriate contact_status
    if (activityType === "follow_up_sent") {
      contactUpdate.contact_status = "follow_up_sent";
    } else {
      contactUpdate.contact_status = activityType; // email_sent or linkedin_sent
    }

    contactUpdate.last_contacted_at = new Date().toISOString();
    contactUpdate.next_follow_up_date = addBusinessDays(new Date(), 5).toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from("recruiter_contacts")
    .update(contactUpdate)
    .eq("id", contactId);

  if (updateError) {
    throw new Error(`Failed to update contact: ${updateError.message}`);
  }

  // Increment follow_up_count separately using rpc or a second update
  if (activityType === "follow_up_sent") {
    const { data: contact } = await supabaseAdmin
      .from("recruiter_contacts")
      .select("follow_up_count")
      .eq("id", contactId)
      .single();

    const currentCount = contact?.follow_up_count ?? 0;

    await supabaseAdmin
      .from("recruiter_contacts")
      .update({ follow_up_count: currentCount + 1 })
      .eq("id", contactId);
  }

  return activity;
}

/**
 * Get the activity timeline for a specific contact, most recent first.
 */
export async function getContactTimeline(contactId: number, limit: number = 20) {
  const { data, error } = await supabaseAdmin
    .from("outreach_activities")
    .select("*")
    .eq("recruiter_contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get contact timeline: ${error.message}`);
  }

  return data;
}

/**
 * Get contacts that are due for follow-up:
 * - Status indicates outreach was made
 * - Last contacted more than 5 days ago
 * - Fewer than 3 follow-ups sent
 * Sorted by days since last contact, oldest first.
 */
export async function getFollowUpsDue(userId: string) {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const { data, error } = await supabaseAdmin
    .from("recruiter_contacts")
    .select(`
      *,
      job_submissions:job_submission_id (
        company_name,
        job_title
      )
    `)
    .eq("user_id", userId)
    .in("contact_status", [
      "email_sent",
      "linkedin_sent",
      "follow_up_needed",
      "awaiting_reply",
    ])
    .lt("last_contacted_at", fiveDaysAgo.toISOString())
    .lt("follow_up_count", 3)
    .order("last_contacted_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get follow-ups due: ${error.message}`);
  }

  return data;
}

/**
 * Get counts of contacts in each pipeline stage for a user.
 */
export async function getPipelineCounts(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("recruiter_contacts")
    .select("contact_status")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to get pipeline counts: ${error.message}`);
  }

  const counts = {
    not_contacted: 0,
    reached_out: 0,
    awaiting_reply: 0,
    replied: 0,
    interview: 0,
  };

  for (const row of data ?? []) {
    const status = row.contact_status;

    if (!status || status === "not_contacted") {
      counts.not_contacted++;
    } else if (status === "email_sent" || status === "linkedin_sent") {
      counts.reached_out++;
    } else if (status === "awaiting_reply" || status === "follow_up_needed") {
      counts.awaiting_reply++;
    } else if (status === "replied") {
      counts.replied++;
    } else if (status === "interview_scheduled") {
      counts.interview++;
    }
  }

  return counts;
}
