-- Add the onboarding columns to production (they exist in staging but were
-- never applied to prod). Also back-fills existing users' checklists from
-- their actual activity so the dashboard shows accurate progress immediately.
--
-- Already executed against production (qwhodlkhvpslehmowccs) on 2026-05-12.
-- Re-running is safe — both ALTER and UPDATE are idempotent in this form.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

UPDATE users u SET onboarding_checklist = jsonb_build_object(
  'account_created', true,
  'first_search',
    EXISTS (SELECT 1 FROM job_submissions js WHERE js.user_id = u.id),
  'first_contact_viewed',
    EXISTS (
      SELECT 1 FROM recruiter_contacts rc
      JOIN job_submissions js ON js.id = rc.job_submission_id
      WHERE js.user_id = u.id
    ),
  'bio_added',
    EXISTS (
      SELECT 1 FROM user_outreach_profiles p
      WHERE p.user_id = u.id AND COALESCE(LENGTH(TRIM(p.bio)), 0) > 0
    ),
  'resume_uploaded',
    EXISTS (
      SELECT 1 FROM user_outreach_profiles p
      WHERE p.user_id = u.id AND COALESCE(LENGTH(TRIM(p.resume_text)), 0) > 0
    ),
  'first_message_generated',
    EXISTS (
      SELECT 1 FROM recruiter_contacts rc
      JOIN job_submissions js ON js.id = rc.job_submission_id
      WHERE js.user_id = u.id
        AND COALESCE(LENGTH(TRIM(rc.generated_email_message)), 0) > 0
    )
);
