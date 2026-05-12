import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabaseClient";
import { getUserSubscription } from "../services/creditService";
import type { PlanType } from "../constants/credits";

// Per-plan daily send caps. Free + starter are tight to deny spam relays;
// pro/max are generous but still bounded so a compromised account can't go
// nuclear before we notice.
const DAILY_SEND_CAP: Record<PlanType, number> = {
  free: 5,
  starter: 50,
  pro: 200,
  max: 500,
};

// Domains we'll never send to from user-supplied addresses (defense against
// using SideDoor as a clean-IP cannon to internal/government targets).
// The actual domain reputation guard is Resend/SendGrid's job; this is
// belt-and-suspenders for obviously-bad targets.
const BLOCKED_RECIPIENT_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "throwaway.email",
]);

export function recipientDomainAllowed(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  if (BLOCKED_RECIPIENT_DOMAINS.has(domain)) return false;
  return true;
}

/**
 * Enforces per-user, per-day outbound email cap based on plan tier.
 * Counts emails sent in the last 24h via the outreach_activities table.
 */
export async function enforceDailySendCap(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.id as string | undefined;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const sub = await getUserSubscription(userId);
  const plan = (sub?.plan_type || "free") as PlanType;
  const cap = DAILY_SEND_CAP[plan] ?? DAILY_SEND_CAP.free;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("outreach_activities")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .eq("activity_type", "email_sent")
    .gte("created_at", since);

  if (error) {
    // Fail open — better to let a legitimate user send than block on a counter
    // glitch. Log loudly so we notice.
    console.error("[sendQuota] count failed, allowing:", error);
    return next();
  }

  if ((count ?? 0) >= cap) {
    return res.status(429).json({
      error: "daily_send_cap_reached",
      message: `You've reached your daily send limit of ${cap} emails on the ${plan} plan. Resets in 24h.`,
      cap,
      planType: plan,
      upgradeUrl: "/billing",
    });
  }

  next();
}
