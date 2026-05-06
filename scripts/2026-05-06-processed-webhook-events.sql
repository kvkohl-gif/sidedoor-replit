-- Stripe webhook idempotency table
-- Run this once in BOTH the staging and production Supabase projects
-- (Supabase Dashboard → SQL Editor → paste → Run).

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS processed_webhook_events_processed_at_idx
  ON processed_webhook_events (processed_at);

-- Optional housekeeping: delete rows older than 30 days.
-- Stripe only retries for ~3 days, so 30 days is plenty for replay protection
-- and audit. Run as a scheduled job or pg_cron task if desired.
--
-- DELETE FROM processed_webhook_events WHERE processed_at < NOW() - INTERVAL '30 days';
