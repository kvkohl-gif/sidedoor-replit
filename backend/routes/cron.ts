import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { supabaseAdmin } from "../lib/supabaseClient";
import { sendTrialReminderEmail, type TrialReminderStage } from "../services/platformEmails";

const router = Router();

// All /api/cron/* routes require a shared-secret header. The caller (Railway
// cron, GitHub Actions, etc.) sets `X-Cron-Secret: <CRON_SECRET>`. We compare
// in constant time. Without the secret set, the route returns 503 in prod and
// is reachable in dev for ergonomics.
function requireCronSecret(req: Request, res: Response, next: () => void) {
  const expected = process.env.CRON_SECRET;
  const isProd = (process.env.APP_ENV || process.env.NODE_ENV) === "production";

  if (!expected) {
    if (isProd) {
      res.status(503).json({ error: "cron_not_configured" });
      return;
    }
    console.warn("[cron] CRON_SECRET not set — accepting requests without auth (dev only)");
    return next();
  }
  const got = (req.headers["x-cron-secret"] as string | undefined) || "";
  let ok = false;
  try {
    ok = got.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch { ok = false; }
  if (!ok) {
    res.status(401).json({ error: "invalid_cron_secret" });
    return;
  }
  next();
}

// ─── POST /api/cron/trial-reminders ──────────────────────────────────
// Finds free-tier users whose trial expires in {3, 1, 0} days and sends a
// reminder email. Idempotent per stage via the
// user_subscriptions.last_trial_reminder_stage column — once we send the "3d"
// email we never send it again, even if you re-run the cron.
//
// Schedule: once per day, any time. Suggested: 14:00 UTC (10 AM ET).
//
// Railway cron config (Settings → Service → Cron):
//   schedule: "0 14 * * *"
//   command: curl -fsS -X POST -H "X-Cron-Secret: $CRON_SECRET" \
//            https://app.thesidedoor.ai/api/cron/trial-reminders
router.post("/trial-reminders", requireCronSecret, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const stages: { stage: TrialReminderStage; daysOut: number }[] = [
      { stage: "3d", daysOut: 3 },
      { stage: "1d", daysOut: 1 },
      { stage: "0d", daysOut: 0 },
    ];

    const summary: Record<string, number> = { "3d": 0, "1d": 0, "0d": 0, errors: 0 };

    for (const { stage, daysOut } of stages) {
      // Window: any free user whose trial expires within the next `daysOut`
      // calendar days but NOT already past the next-shorter window.
      // For 3d: expires in 2-3 days. For 1d: expires in 0-1 day. For 0d: expired today.
      // We use a 24-hour band to keep things robust to cron-time drift.
      const lowerHours = (daysOut - 0.5) * 24;
      const upperHours = (daysOut + 0.5) * 24;
      const lower = new Date(now.getTime() + lowerHours * 60 * 60 * 1000).toISOString();
      const upper = new Date(now.getTime() + upperHours * 60 * 60 * 1000).toISOString();

      const { data: rows, error } = await supabaseAdmin
        .from("user_subscriptions")
        .select("user_id, last_trial_reminder_stage, free_tier_expires_at, users!inner(email, first_name)")
        .eq("plan_type", "free")
        .eq("status", "active")
        .gte("free_tier_expires_at", lower)
        .lt("free_tier_expires_at", upper);

      if (error) {
        console.error(`[cron/trial-reminders ${stage}] query failed:`, error);
        summary.errors += 1;
        continue;
      }

      for (const row of rows || []) {
        // Skip if we already sent this stage (or a later/more-urgent one).
        const last = (row as any).last_trial_reminder_stage as TrialReminderStage | null;
        if (last === stage) continue;
        if (stage === "3d" && (last === "1d" || last === "0d")) continue;
        if (stage === "1d" && last === "0d") continue;

        const u = (row as any).users;
        if (!u?.email) continue;

        try {
          await sendTrialReminderEmail(u.email, u.first_name || undefined, stage);
          await supabaseAdmin
            .from("user_subscriptions")
            .update({ last_trial_reminder_stage: stage })
            .eq("user_id", row.user_id);
          summary[stage] += 1;
        } catch (err) {
          console.error(`[cron/trial-reminders ${stage}] send failed for ${row.user_id}:`, err);
          summary.errors += 1;
        }
      }
    }

    return res.json({ success: true, sent: summary });
  } catch (error) {
    console.error("[cron/trial-reminders] fatal:", error);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
