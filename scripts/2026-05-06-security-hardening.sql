-- Security hardening migration
-- Run once in BOTH staging and production Supabase projects
-- (Supabase Dashboard → SQL Editor → paste → Run).
--
-- Bundles all schema changes required by the security audit fixes:
--   • email verification flow  (audit C6)
--   • idle session timeout     (audit M4)

-- 1. Track email-verification state on users.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill: existing users (created before email verification shipped) are
--    grandfathered as verified so they don't get locked out.
UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;

-- 3. Email verification tokens (mirrors password_reset_tokens shape).
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx
  ON email_verification_tokens (user_id);
CREATE INDEX IF NOT EXISTS email_verification_tokens_token_idx
  ON email_verification_tokens (token);

-- 4. Idle-timeout column on sessions.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- 5. Backfill last_activity_at to created_at where present, otherwise NOW().
UPDATE sessions
SET last_activity_at = COALESCE(created_at, NOW())
WHERE last_activity_at IS NULL;

-- 6. Helpful index for the cleanup pass that the app does on each request.
CREATE INDEX IF NOT EXISTS sessions_last_activity_idx
  ON sessions (last_activity_at);
