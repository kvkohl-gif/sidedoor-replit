-- ============================================================================
-- Test data seed for message generation testing
-- Run against staging Supabase: jyjxwtmktotlefixpakv
--
-- Creates 4 test personas with full profiles, 5 job submissions, 8 contacts.
-- Cleanup script: scripts/cleanup-test-personas.sql
-- ============================================================================

-- All test data uses the @sidedoor-test.com domain so it's easy to filter & delete.
-- Password hash below is for "TestPass123!" — bcrypt rounds=10
-- Generated with: python -c "import bcrypt; print(bcrypt.hashpw(b'TestPass123!', bcrypt.gensalt(10)).decode())"

-- ─── Test Users ─────────────────────────────────────────────────────────────

INSERT INTO users (id, email, first_name, last_name, password_hash, created_at)
VALUES
  ('test-kate-farmkid', 'kate-test@sidedoor-test.com', 'Kate', 'Test', '$2b$10$rZqVqZqVqZqVqZqVqZqVqOYYQq8zN9Yr4o1cVK0jQK8q3oVqK8oG.', NOW()),
  ('test-marco-petowner', 'marco-test@sidedoor-test.com', 'Marco', 'Test', '$2b$10$rZqVqZqVqZqVqZqVqZqVqOYYQq8zN9Yr4o1cVK0jQK8q3oVqK8oG.', NOW()),
  ('test-avery-builder', 'avery-test@sidedoor-test.com', 'Avery', 'Test', '$2b$10$rZqVqZqVqZqVqZqVqZqVqOYYQq8zN9Yr4o1cVK0jQK8q3oVqK8oG.', NOW()),
  ('test-sam-networked', 'sam-test@sidedoor-test.com', 'Sam', 'Test', '$2b$10$rZqVqZqVqZqVqZqVqZqVqOYYQq8zN9Yr4o1cVK0jQK8q3oVqK8oG.', NOW())
ON CONFLICT (id) DO NOTHING;

-- ─── Persona 1: Kate (origin story → A1) ────────────────────────────────────

INSERT INTO user_outreach_profiles (
  user_id, bio, resume_text, resume_filename,
  achievements, story_hooks, hobbies, career_goals,
  voice_formality, voice_directness, voice_length, voice_notes,
  portfolio_items, mutual_connections, profile_completeness, updated_at
) VALUES (
  'test-kate-farmkid',
  'Senior Product Manager with 6+ years building 0-to-1 SaaS at early-stage startups. Specializes in vertical SaaS, onboarding optimization, and customer discovery.',
  'KATE TEST — Senior Product Manager
6+ years product experience at early-stage startups

EXPERIENCE
Senior PM, B2B SaaS startup (2022-Present)
- Led PLG onboarding redesign that lifted activation 32% in 90 days
- Owned the customer discovery process for new vertical expansion
- Shipped 12 features end-to-end with a team of 4 engineers

PM, Vertical SaaS (2019-2022)
- Launched 3 vertical SaaS products from 0 to $1M ARR
- Built and scaled the customer onboarding playbook
- Ran weekly customer interviews and synthesized findings into roadmap

EDUCATION
Babson College, Class of 2019',
  'kate-test-resume.pdf',
  '["Led PLG onboarding redesign that lifted activation 32%", "Launched 3 vertical SaaS products from 0 to $1M ARR", "Owned customer discovery for vertical expansion"]'::text,
  '["I grew up on a small family farm in Western Massachusetts — baling hay, herding cattle, the whole thing", "My family ran a hardware store for 30 years before we sold it"]'::text,
  '["Cooking", "Hiking with my dog"]'::text,
  'Build product at a vertical SaaS company solving real-world problems for industries that have been underserved by tech',
  0.4, 0.7, 0.3, 'Direct but warm — never corporate-speak.',
  '[]'::jsonb,
  '[]'::jsonb,
  90,
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  bio = EXCLUDED.bio,
  resume_text = EXCLUDED.resume_text,
  achievements = EXCLUDED.achievements,
  story_hooks = EXCLUDED.story_hooks,
  hobbies = EXCLUDED.hobbies,
  career_goals = EXCLUDED.career_goals,
  voice_formality = EXCLUDED.voice_formality,
  voice_directness = EXCLUDED.voice_directness,
  voice_length = EXCLUDED.voice_length,
  voice_notes = EXCLUDED.voice_notes,
  portfolio_items = EXCLUDED.portfolio_items,
  mutual_connections = EXCLUDED.mutual_connections,
  updated_at = NOW();

-- ─── Persona 2: Marco (lived experience → A2) ────────────────────────────────

INSERT INTO user_outreach_profiles (
  user_id, bio, resume_text, resume_filename,
  achievements, story_hooks, hobbies, career_goals,
  voice_formality, voice_directness, voice_length, voice_notes,
  portfolio_items, mutual_connections, profile_completeness, updated_at
) VALUES (
  'test-marco-petowner',
  'Product designer turned PM with 5 years in consumer SaaS. Deep experience in onboarding, growth loops, and user research.',
  'MARCO TEST — Product Manager
5+ years in consumer SaaS, design background

EXPERIENCE
Senior PM, Consumer App (2023-Present)
- Owned the entire onboarding funnel for a 50K-user consumer app
- Designed and shipped a referral program that drove 18% MoM growth
- Led 30+ user research sessions to inform product decisions

PM, Mobile App (2020-2023)
- Built the activation flow that doubled D7 retention
- Owned the engagement loop redesign

DESIGN
- 3 years as a senior product designer before transitioning to PM
- Strong design intuition for consumer products',
  'marco-test-resume.pdf',
  '["Owned the entire onboarding funnel for a 50K-user consumer app", "Designed and shipped a referral program that drove 18% MoM growth", "Led 30+ user research sessions"]'::text,
  '["I''m a devoted pet owner with two rescue dogs who think they own the apartment", "I''ve been a Petvisor product user for 2 years as a customer"]'::text,
  '["Pets", "Photography"]'::text,
  'Senior PM role at a consumer or vertical SaaS company where my design background is an asset',
  0.5, 0.6, 0.3, '',
  '[]'::jsonb,
  '[]'::jsonb,
  85,
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  bio = EXCLUDED.bio, resume_text = EXCLUDED.resume_text, achievements = EXCLUDED.achievements,
  story_hooks = EXCLUDED.story_hooks, hobbies = EXCLUDED.hobbies, career_goals = EXCLUDED.career_goals,
  voice_formality = EXCLUDED.voice_formality, voice_directness = EXCLUDED.voice_directness,
  voice_length = EXCLUDED.voice_length, portfolio_items = EXCLUDED.portfolio_items,
  mutual_connections = EXCLUDED.mutual_connections, updated_at = NOW();

-- ─── Persona 3: Avery (portfolio → C) ────────────────────────────────────────

INSERT INTO user_outreach_profiles (
  user_id, bio, resume_text, resume_filename,
  achievements, story_hooks, hobbies, career_goals,
  voice_formality, voice_directness, voice_length, voice_notes,
  portfolio_items, mutual_connections, profile_completeness, updated_at
) VALUES (
  'test-avery-builder',
  'Full-stack PM who ships side projects. 4 years in product, 6 years in engineering before that.',
  'AVERY TEST — Product Manager + Builder
4 years PM, 6 years engineering background

EXPERIENCE
Senior PM, B2B SaaS (2022-Present)
- Built and shipped 4 production prototypes in the last year
- Led the technical PM role on the AI features team

PM, Fintech Startup (2020-2022)
- Built a financial literacy app for kids called pigEbank from prototype to launch
- Owned the kid-safe payment flow and parent dashboard

ENGINEER, SaaS (2014-2020)
- Full-stack engineer at multiple startups
- Strong technical foundation lets me prototype anything quickly',
  'avery-test-resume.pdf',
  '["Built a financial literacy app for kids called pigEbank from prototype to launch", "Shipped 4 production prototypes in the last year", "Owned the kid-safe payment flow at a fintech startup"]'::text,
  '["I''m passionate about financial literacy for the next generation", "I prototype side projects every weekend"]'::text,
  '["Side projects", "Building things"]'::text,
  'PM role at a company where I can ship fast and build products that matter',
  0.5, 0.7, 0.3, '',
  '[
    {"url": "https://figma.com/file/example/pigEbank", "description": "pigEbank — financial literacy prototype for kids", "domain_tags": ["fintech", "edtech", "kids", "financial literacy", "money", "prosprous"]},
    {"url": "https://github.com/avery/farmtech", "description": "Crop yield prediction tool for small farms", "domain_tags": ["agtech", "farm", "agriculture", "farmhand"]}
  ]'::jsonb,
  '[]'::jsonb,
  95,
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  bio = EXCLUDED.bio, resume_text = EXCLUDED.resume_text, achievements = EXCLUDED.achievements,
  story_hooks = EXCLUDED.story_hooks, hobbies = EXCLUDED.hobbies, career_goals = EXCLUDED.career_goals,
  voice_formality = EXCLUDED.voice_formality, voice_directness = EXCLUDED.voice_directness,
  voice_length = EXCLUDED.voice_length, portfolio_items = EXCLUDED.portfolio_items,
  mutual_connections = EXCLUDED.mutual_connections, updated_at = NOW();

-- ─── Persona 4: Sam (mutual connection → D) ──────────────────────────────────

INSERT INTO user_outreach_profiles (
  user_id, bio, resume_text, resume_filename,
  achievements, story_hooks, hobbies, career_goals,
  voice_formality, voice_directness, voice_length, voice_notes,
  portfolio_items, mutual_connections, profile_completeness, updated_at
) VALUES (
  'test-sam-networked',
  'VP Operations with strong startup network. 8 years scaling early-stage teams.',
  'SAM TEST — VP Operations
8+ years scaling startup operations

EXPERIENCE
VP Operations, Series B Fintech (2021-Present)
- Scaled ops team from 20 to 80 people
- Built the operating cadence and OKR system from scratch
- Reduced operational overhead by 25% through automation

Director of Operations, Series A SaaS (2019-2021)
- First operations hire
- Set up finance, HR, and legal foundations',
  'sam-test-resume.pdf',
  '["Scaled ops at a Series B fintech from 20 to 80 people", "Built the operating cadence and OKR system from scratch", "Reduced operational overhead by 25% through automation"]'::text,
  '[]'::text,
  '["Networking", "Coffee chats"]'::text,
  'COO or VP Ops role at a Series B/C startup',
  0.6, 0.8, 0.3, '',
  '[]'::jsonb,
  '[
    {"name": "Stephanie Cziria", "company": "Aha!", "context": "She thought there might be a strong fit for the PM role"},
    {"name": "Jordan Lee", "company": "Linear", "context": "We worked together at Stripe and he mentioned the COO role"}
  ]'::jsonb,
  90,
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  bio = EXCLUDED.bio, resume_text = EXCLUDED.resume_text, achievements = EXCLUDED.achievements,
  story_hooks = EXCLUDED.story_hooks, hobbies = EXCLUDED.hobbies, career_goals = EXCLUDED.career_goals,
  voice_formality = EXCLUDED.voice_formality, voice_directness = EXCLUDED.voice_directness,
  voice_length = EXCLUDED.voice_length, portfolio_items = EXCLUDED.portfolio_items,
  mutual_connections = EXCLUDED.mutual_connections, updated_at = NOW();

-- ─── Job Submissions ─────────────────────────────────────────────────────────

INSERT INTO job_submissions (user_id, job_input, input_type, company_name, job_title, status, submitted_at)
VALUES
  ('test-kate-farmkid', 'Senior Product Manager at Farmhand. We are building modern software tools for small and mid-sized farms. The role owns the customer discovery process and the new vertical expansion roadmap. Requirements: 5+ years product management at early-stage SaaS, experience with vertical software, ability to run customer interviews, comfort working directly with engineers.', 'paste', 'Farmhand', 'Senior Product Manager', 'completed', NOW()),
  ('test-marco-petowner', 'Product Manager — Onboarding at Petvisor. Petvisor is the operating system for veterinary clinics and pet care providers. We help busy clinics run their entire business from one platform. The PM role owns activation, onboarding, and the first-90-day customer experience. Requirements: 4+ years consumer or vertical SaaS PM experience, strong design intuition, history of running user research.', 'paste', 'Petvisor', 'Product Manager, Onboarding', 'completed', NOW()),
  ('test-avery-builder', 'Senior Product Manager, Growth at Prosprous.ai. We are building AI-powered financial literacy tools for kids and parents. The role owns the activation funnel and the parent-child onboarding experience. Requirements: 5+ years product experience, fintech or edtech background a plus, ability to ship fast.', 'paste', 'Prosprous.ai', 'Senior Product Manager, Growth', 'completed', NOW()),
  ('test-sam-networked', 'Product Manager at Aha!. Aha! is the world''s #1 product development software. We help companies build lovable products and be happy doing it. The PM role owns the roadmap planning experience and integrations. Requirements: 5+ years PM at SaaS companies, experience with B2B tools, strong written communication.', 'paste', 'Aha!', 'Product Manager', 'completed', NOW()),
  ('test-kate-farmkid', 'Growth PM at Knack. Knack is a no-code platform for building business apps. The Growth PM role owns activation and onboarding for our PLG motion. Requirements: 5+ years PM experience, PLG and onboarding experience, comfort with data and experimentation.', 'paste', 'Knack', 'Growth Product Manager', 'completed', NOW())
RETURNING id;

-- We need the IDs back from the inserts above to seed contacts.
-- The test script will query them by company_name + user_id.

-- ─── Recruiter Contacts ──────────────────────────────────────────────────────
-- Each job gets a HM and a recruiter so we can test routing in both directions.

INSERT INTO recruiter_contacts (job_submission_id, name, title, email, outreach_bucket, department, source, contact_status, created_at, updated_at)
SELECT j.id, 'Ari Founder', 'Founder', 'ari@farmhand-test.com', 'department_lead', 'Executive', 'test_seed', 'not_contacted', NOW(), NOW()
FROM job_submissions j WHERE j.user_id = 'test-kate-farmkid' AND j.company_name = 'Farmhand' LIMIT 1;

INSERT INTO recruiter_contacts (job_submission_id, name, title, email, outreach_bucket, department, source, contact_status, created_at, updated_at)
SELECT j.id, 'Jen Recruiter', 'Senior Talent Partner', 'jen@farmhand-test.com', 'recruiter', 'Talent', 'test_seed', 'not_contacted', NOW(), NOW()
FROM job_submissions j WHERE j.user_id = 'test-kate-farmkid' AND j.company_name = 'Farmhand' LIMIT 1;

INSERT INTO recruiter_contacts (job_submission_id, name, title, email, outreach_bucket, department, source, contact_status, created_at, updated_at)
SELECT j.id, 'Emily Smith', 'Head of Product', 'emily@petvisor-test.com', 'department_lead', 'Product', 'test_seed', 'not_contacted', NOW(), NOW()
FROM job_submissions j WHERE j.user_id = 'test-marco-petowner' AND j.company_name = 'Petvisor' LIMIT 1;

INSERT INTO recruiter_contacts (job_submission_id, name, title, email, outreach_bucket, department, source, contact_status, created_at, updated_at)
SELECT j.id, 'Kolbi Wilson', 'Talent Acquisition Manager', 'kolbi@petvisor-test.com', 'recruiter', 'People Ops', 'test_seed', 'not_contacted', NOW(), NOW()
FROM job_submissions j WHERE j.user_id = 'test-marco-petowner' AND j.company_name = 'Petvisor' LIMIT 1;

INSERT INTO recruiter_contacts (job_submission_id, name, title, email, outreach_bucket, department, source, contact_status, created_at, updated_at)
SELECT j.id, 'Ted Founder', 'CEO and Founder', 'ted@prosprous-test.com', 'department_lead', 'Executive', 'test_seed', 'not_contacted', NOW(), NOW()
FROM job_submissions j WHERE j.user_id = 'test-avery-builder' AND j.company_name = 'Prosprous.ai' LIMIT 1;

INSERT INTO recruiter_contacts (job_submission_id, name, title, email, outreach_bucket, department, source, contact_status, created_at, updated_at)
SELECT j.id, 'Pat Sourcer', 'Sourcer', 'pat@prosprous-test.com', 'recruiter', 'Recruiting', 'test_seed', 'not_contacted', NOW(), NOW()
FROM job_submissions j WHERE j.user_id = 'test-avery-builder' AND j.company_name = 'Prosprous.ai' LIMIT 1;

INSERT INTO recruiter_contacts (job_submission_id, name, title, email, outreach_bucket, department, source, contact_status, created_at, updated_at)
SELECT j.id, 'Holly Manager', 'VP of Product', 'holly@aha-test.com', 'department_lead', 'Product', 'test_seed', 'not_contacted', NOW(), NOW()
FROM job_submissions j WHERE j.user_id = 'test-sam-networked' AND j.company_name = 'Aha!' LIMIT 1;

INSERT INTO recruiter_contacts (job_submission_id, name, title, email, outreach_bucket, department, source, contact_status, created_at, updated_at)
SELECT j.id, 'Sara Recruiter', 'Head of Talent', 'sara@aha-test.com', 'recruiter', 'Talent', 'test_seed', 'not_contacted', NOW(), NOW()
FROM job_submissions j WHERE j.user_id = 'test-sam-networked' AND j.company_name = 'Aha!' LIMIT 1;

INSERT INTO recruiter_contacts (job_submission_id, name, title, email, outreach_bucket, department, source, contact_status, created_at, updated_at)
SELECT j.id, 'Dana Recruiter', 'Senior Recruiter', 'dana@knack-test.com', 'recruiter', 'Recruiting', 'test_seed', 'not_contacted', NOW(), NOW()
FROM job_submissions j WHERE j.user_id = 'test-kate-farmkid' AND j.company_name = 'Knack' LIMIT 1;

-- ─── Verification query ──────────────────────────────────────────────────────
-- Run this after seeding to confirm everything is in place:
SELECT
  u.id AS user_id,
  u.first_name,
  u.email,
  COUNT(DISTINCT j.id) AS jobs,
  COUNT(DISTINCT rc.id) AS contacts,
  CASE WHEN p.user_id IS NOT NULL THEN 'yes' ELSE 'no' END AS has_profile
FROM users u
LEFT JOIN user_outreach_profiles p ON p.user_id = u.id
LEFT JOIN job_submissions j ON j.user_id = u.id
LEFT JOIN recruiter_contacts rc ON rc.job_submission_id = j.id
WHERE u.email LIKE '%@sidedoor-test.com'
GROUP BY u.id, u.first_name, u.email, p.user_id
ORDER BY u.first_name;
