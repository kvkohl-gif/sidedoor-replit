-- One-time cleanup: remove synthetic "No Recruiter Contacts Found" placeholder
-- rows that were previously inserted into recruiter_contacts when an Apollo search
-- returned zero results. These rows had no email, no LinkedIn URL, and the default
-- outreach_bucket = 'recruiter' — which caused them to be counted in the
-- "Recruiters" chip on the job detail page even though they're not real people.
--
-- Backend insert was removed in the same change that introduced this script
-- (backend/routes.ts, "No Recruiter Contacts Found" block deleted). Run this
-- once against production to clean up rows already in the table.
--
-- Safety guard: also requires email IS NULL and source = 'Apollo Search' so we
-- can't accidentally delete a real contact someone manually named oddly.

BEGIN;

-- Preview what will be deleted (run this first, eyeball the count)
SELECT COUNT(*) AS placeholder_rows_to_delete
FROM recruiter_contacts
WHERE name = 'No Recruiter Contacts Found'
  AND email IS NULL
  AND source = 'Apollo Search';

-- Actual delete
DELETE FROM recruiter_contacts
WHERE name = 'No Recruiter Contacts Found'
  AND email IS NULL
  AND source = 'Apollo Search';

COMMIT;
