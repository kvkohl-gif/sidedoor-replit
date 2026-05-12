-- Track which trial-end reminder emails we've already sent per user.
-- Run once in BOTH staging and production Supabase projects.

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS last_trial_reminder_stage TEXT
    CHECK (last_trial_reminder_stage IN ('3d', '1d', '0d'));

-- Optional index for the cron query (we filter by plan_type + status +
-- expires_at; this index just keeps the cron's reminder-check fast as the
-- user table grows).
CREATE INDEX IF NOT EXISTS user_subscriptions_trial_reminders_idx
  ON user_subscriptions (free_tier_expires_at)
  WHERE plan_type = 'free' AND status = 'active';
