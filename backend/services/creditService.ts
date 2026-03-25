import { supabaseAdmin } from "../lib/supabaseClient";
import { PLAN_CREDITS, FREE_TIER_DAYS, type PlanType } from "../constants/credits";
import { nanoid } from "nanoid";

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  credits_remaining: number;
  credits_total: number;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  free_tier_expires_at: string | null;
  created_at: string;
}

/**
 * Get user's current subscription. Returns null if none exists.
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data as UserSubscription;
}

/**
 * Check if user has enough credits AND their account is active.
 * Returns { allowed, reason } for detailed error handling.
 */
export async function checkCredits(
  userId: string,
  cost: number
): Promise<{ allowed: boolean; reason?: string; subscription?: UserSubscription }> {
  const sub = await getUserSubscription(userId);

  if (!sub) {
    return { allowed: false, reason: "no_subscription" };
  }

  if (sub.status === "canceled") {
    return { allowed: false, reason: "subscription_canceled", subscription: sub };
  }

  if (sub.status === "past_due") {
    return { allowed: false, reason: "payment_past_due", subscription: sub };
  }

  // Free tier expiry check
  if (sub.plan_type === "free" && sub.free_tier_expires_at) {
    if (new Date(sub.free_tier_expires_at) < new Date()) {
      return { allowed: false, reason: "trial_expired", subscription: sub };
    }
  }

  if (sub.credits_remaining < cost) {
    return { allowed: false, reason: "insufficient_credits", subscription: sub };
  }

  return { allowed: true, subscription: sub };
}

/**
 * Deduct credits atomically using Supabase RPC or manual check-and-update.
 * IMPORTANT: Call this AFTER successful action completion, not before.
 */
export async function deductCredits(
  userId: string,
  cost: number,
  transactionType: string,
  description: string,
  jobSubmissionId?: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  // Fetch current subscription
  const sub = await getUserSubscription(userId);
  if (!sub) return { success: false, error: "No subscription found" };

  if (sub.credits_remaining < cost) {
    return { success: false, error: "Insufficient credits" };
  }

  const newBalance = sub.credits_remaining - cost;

  // Update credits
  const { error: updateError } = await supabaseAdmin
    .from("user_subscriptions")
    .update({ credits_remaining: newBalance })
    .eq("user_id", userId)
    .eq("credits_remaining", sub.credits_remaining); // Optimistic lock: only update if balance hasn't changed

  if (updateError) {
    console.error("Credit deduction error:", updateError);
    return { success: false, error: "Failed to deduct credits" };
  }

  // Log the transaction
  await supabaseAdmin.from("credit_transactions").insert({
    id: nanoid(),
    user_id: userId,
    amount: -cost,
    balance_after: newBalance,
    transaction_type: transactionType,
    description,
    job_submission_id: jobSubmissionId || null,
    created_at: new Date().toISOString(),
  });

  return { success: true, newBalance };
}

/**
 * Grant credits to a user (purchase, monthly reset, etc.)
 */
export async function grantCredits(
  userId: string,
  amount: number,
  transactionType: string,
  description: string
): Promise<{ success: boolean; newBalance?: number }> {
  const sub = await getUserSubscription(userId);
  if (!sub) return { success: false };

  const newBalance = sub.credits_remaining + amount;

  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({ credits_remaining: newBalance })
    .eq("user_id", userId);

  if (error) {
    console.error("Credit grant error:", error);
    return { success: false };
  }

  await supabaseAdmin.from("credit_transactions").insert({
    id: nanoid(),
    user_id: userId,
    amount,
    balance_after: newBalance,
    transaction_type: transactionType,
    description,
    created_at: new Date().toISOString(),
  });

  return { success: true, newBalance };
}

/**
 * Reset credits to plan maximum (called on monthly renewal).
 */
export async function resetMonthlyCredits(
  userId: string,
  planType: PlanType
): Promise<{ success: boolean }> {
  const planCredits = PLAN_CREDITS[planType];
  if (!planCredits || planCredits.monthly === 0) return { success: false };

  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({
      credits_remaining: planCredits.monthly,
      credits_total: planCredits.monthly,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Monthly reset error:", error);
    return { success: false };
  }

  await supabaseAdmin.from("credit_transactions").insert({
    id: nanoid(),
    user_id: userId,
    amount: planCredits.monthly,
    balance_after: planCredits.monthly,
    transaction_type: "monthly_reset",
    description: `Monthly credit reset (${planType} plan)`,
    created_at: new Date().toISOString(),
  });

  return { success: true };
}

/**
 * Get transaction history for a user.
 */
export async function getTransactionHistory(userId: string, limit = 50) {
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Transaction history error:", error);
    return [];
  }

  return data || [];
}

/**
 * Create a free-tier subscription for a new user.
 */
export async function createFreeSubscription(userId: string): Promise<{ success: boolean }> {
  const freeCredits = PLAN_CREDITS.free.total;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + FREE_TIER_DAYS);

  const { error } = await supabaseAdmin.from("user_subscriptions").insert({
    id: nanoid(),
    user_id: userId,
    plan_type: "free",
    status: "active",
    credits_remaining: freeCredits,
    credits_total: freeCredits,
    free_tier_expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Free subscription creation error:", error);
    return { success: false };
  }

  // Log the initial grant
  await supabaseAdmin.from("credit_transactions").insert({
    id: nanoid(),
    user_id: userId,
    amount: freeCredits,
    balance_after: freeCredits,
    transaction_type: "free_grant",
    description: "Welcome! 5 free searches to get started",
    created_at: new Date().toISOString(),
  });

  return { success: true };
}
