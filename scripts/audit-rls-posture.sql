-- RLS posture audit (security audit M8).
--
-- We use supabaseAdmin (service-role key) for all queries server-side, and the
-- anon key is NOT shipped to the frontend, so RLS is currently defense-in-depth
-- rather than a primary control. But: if the anon key ever leaks (Railway env
-- exposure, log line, ex-employee), every table without RLS becomes wide open
-- via PostgREST. So we want every table to have RLS enabled with FORCE and a
-- default-deny posture.
--
-- HOW TO USE:
--   1. Run the audit query below in Supabase SQL Editor.
--   2. For each row where rls_enabled = false OR rls_forced = false, run
--      `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY; ALTER TABLE <name> FORCE ROW LEVEL SECURITY;`
--   3. Repeat per environment (staging + production).
--
-- (We don't do this in a migration because reviewing each table for the right
-- policy is a one-time human decision.)

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  forcerowsecurity AS rls_forced,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.schemaname = c.schemaname AND p.tablename = c.tablename) AS policy_count
FROM pg_tables c
WHERE schemaname = 'public'
ORDER BY rls_enabled ASC, rls_forced ASC, tablename;

-- TEMPLATE for enabling RLS with default-deny (anon = no access, service-role
-- bypasses RLS automatically):
--
-- ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE <name> FORCE ROW LEVEL SECURITY;
-- -- (no policies = default-deny for non-service-role)
