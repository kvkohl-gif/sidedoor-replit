import { supabaseAdmin } from "../lib/supabaseClient";

interface NotificationRecord {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  is_read: boolean;
  is_email_sent: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  actionUrl?: string,
  metadata?: Record<string, unknown>
): Promise<NotificationRecord> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl ?? null,
      metadata: metadata ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return data as NotificationRecord;
}

export async function getNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<NotificationRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get notifications: ${error.message}`);
  }

  return (data as NotificationRecord[]) ?? [];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(`Failed to get unread count: ${error.message}`);
  }

  return count ?? 0;
}

export async function markAsRead(
  notificationId: number,
  userId: string
): Promise<NotificationRecord> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  return data as NotificationRecord;
}

export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
}

export async function createContactsFoundNotification(
  userId: string,
  count: number,
  companyName: string,
  submissionId: string
): Promise<NotificationRecord> {
  return createNotification(
    userId,
    "contacts_found",
    `${count} contacts found at ${companyName}`,
    `We found ${count} verified contact${count === 1 ? "" : "s"} at ${companyName}. View the results to start your outreach.`,
    `/submissions/${submissionId}`,
    { count, companyName, submissionId }
  );
}

export async function createFollowUpNotification(
  userId: string,
  contactName: string,
  contactId: string,
  daysSinceOutreach: number
): Promise<NotificationRecord> {
  return createNotification(
    userId,
    "follow_up_due",
    `Follow up with ${contactName}`,
    `It's been ${daysSinceOutreach} day${daysSinceOutreach === 1 ? "" : "s"} since your last outreach to ${contactName}. Consider sending a follow-up.`,
    `/contacts/${contactId}`,
    { contactName, contactId, daysSinceOutreach }
  );
}

export async function createCreditsLowNotification(
  userId: string,
  creditsRemaining: number
): Promise<NotificationRecord> {
  return createNotification(
    userId,
    "credits_low",
    "Credits running low",
    `You have ${creditsRemaining} credit${creditsRemaining === 1 ? "" : "s"} remaining. Upgrade your plan to continue finding contacts.`,
    "/settings/billing",
    { creditsRemaining }
  );
}
