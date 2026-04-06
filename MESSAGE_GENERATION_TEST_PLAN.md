# Message Generation Testing Plan

End-to-end test plan for the AI email generation framework. Validates the 7 templates, selection logic, field population, quality scoring, anti-pattern detection, and edge cases against the staging environment.

---

## Goals

1. Verify the right template fires for every input combination (selection logic)
2. Verify every variable in the reference doc actually populates real content (no placeholders, no "[Your Name]")
3. Verify quality scoring catches bad output (banned phrases, missing CTAs, generic openers)
4. Verify edge cases don't crash the generator (empty profile, missing fields, long inputs)
5. Verify the 4 generation endpoints all work end-to-end
6. Verify multiple personas produce visibly different output (proves personalization is real, not theater)

---

## Test Personas

We seed 4 test users covering the full input matrix. Each persona is designed to trigger a specific template and prove specific fields populate correctly.

### Persona 1: "Kate the Farm Kid" (origin-story user)
- **Trigger template**: A1 (origin story)
- **First name**: Kate
- **Bio**: Senior Product Manager with 6+ years at early-stage startups
- **Story hooks**: ["I grew up on a small family farm in Western Massachusetts", "My family ran a hardware store for 30 years"]
- **Achievements**: ["Led PLG onboarding redesign that lifted activation 32%", "Launched 3 vertical SaaS products from 0 to $1M ARR"]
- **Career goals**: "Build product at a vertical SaaS company solving real-world problems"
- **Voice**: formality 0.4, directness 0.7, length 0.3 (concise + direct)
- **Resume**: Full text with metrics
- **Portfolio items**: NONE (so portfolio doesn't trigger C)
- **Mutual connections**: NONE (so D doesn't trigger)

### Persona 2: "Marco the Pet Owner" (lived-experience user)
- **Trigger template**: A2 (lived experience)
- **First name**: Marco
- **Bio**: Product designer turned PM, 5 years in consumer SaaS
- **Story hooks**: ["I'm a devoted pet owner with two rescue dogs", "I've used Petvisor's products for 2 years as a customer"]
- **Achievements**: ["Owned the entire onboarding funnel for a 50K-user consumer app", "Designed and shipped a referral program that drove 18% MoM growth"]
- **Career goals**: "Senior PM role at a consumer or vertical SaaS company"
- **Portfolio items**: NONE
- **Mutual connections**: NONE

### Persona 3: "Avery the Builder" (portfolio user)
- **Trigger template**: C (prototype play)
- **First name**: Avery
- **Bio**: Full-stack PM who ships side projects
- **Achievements**: ["Built a financial literacy app for kids called pigEbank", "Shipped 4 production prototypes in the last year"]
- **Story hooks**: ["I'm passionate about financial literacy for the next generation"]
- **Portfolio items**:
  - { url: "https://figma.com/file/example", description: "Financial literacy prototype for kids", domain_tags: ["fintech", "edtech", "kids", "financial literacy"] }
  - { url: "https://github.com/example/farmtech", description: "Crop yield prediction tool for small farms", domain_tags: ["agtech", "farm", "agriculture"] }
- **Mutual connections**: NONE

### Persona 4: "Sam the Networked" (mutual connection user)
- **Trigger template**: D (mutual connection)
- **First name**: Sam
- **Bio**: VP Operations with strong startup network
- **Achievements**: ["Scaled ops at a Series B fintech from 20 to 80 people"]
- **Mutual connections**:
  - { name: "Stephanie Cziria", company: "Aha!", context: "She thought there might be a strong fit for the PM role" }
  - { name: "Jordan Lee", company: "Linear", context: "We worked together at Stripe and he mentioned the COO role" }
- **Portfolio items**: NONE

---

## Test Job Submissions

Each persona will have multiple job submissions covering different industries — proves the AI uses real JD content, not boilerplate.

| # | Company | Role | Industry | Use case |
|---|---------|------|----------|----------|
| 1 | Farmhand | Senior Product Manager | Agtech | Tests Kate's farm origin story (A1) |
| 2 | Petvisor | Product Manager, Onboarding | Pet care SaaS | Tests Marco's pet owner hook (A2) |
| 3 | Prosprous.ai | Senior PM, Growth | Fintech / kids | Tests Avery's portfolio match (C) |
| 4 | Aha! | Product Manager | Roadmap software | Tests Sam's mutual connection (D) |
| 5 | Knack | Growth PM | No-code platform | Generic test (B default) |

---

## Test Contacts

For each job, we create 2 contacts with different titles to test the recruiter-vs-hiring-manager routing:

| Contact | Title | Outreach Bucket | Routes to |
|---------|-------|-----------------|-----------|
| Ari Founder | Founder | department_lead | A1/A2 (HM) |
| Kolbi Wilson | Senior Talent Partner | recruiter | B (recruiter) |
| Emily Smith | Head of Product | department_lead | A1/A2 (HM) |
| Jen Recruiter | Sourcer | recruiter | B (recruiter) |

---

## Test Matrix: Template Selection Logic

This is the **selection priority** test. The selector must obey this order:
`mutual > portfolio > recruiter > origin_hook > lived_hook > default`

| # | Persona | Contact | Mutual? | Portfolio Match? | Is Recruiter? | Hook Type | Expected Template | Actual | ✅ |
|---|---------|---------|---------|------------------|---------------|-----------|-------------------|--------|---|
| 1 | Sam | Aha! HM | ✓ | - | - | - | D_mutual_connection | | |
| 2 | Sam | Aha! Recruiter | ✓ | - | ✓ | - | D_mutual_connection | | |
| 3 | Avery | Prosprous HM | - | ✓ | - | lived | C_prototype | | |
| 4 | Avery | Prosprous Recruiter | - | ✓ | ✓ | lived | C_prototype | | |
| 5 | Kate | Knack Recruiter | - | - | ✓ | origin | B_recruiter | | |
| 6 | Marco | Knack Recruiter | - | - | ✓ | lived | B_recruiter | | |
| 7 | Kate | Farmhand HM | - | - | - | origin | A1_origin_story | | |
| 8 | Marco | Petvisor HM | - | - | - | lived | A2_lived_experience | | |
| 9 | Kate | Knack HM (no profile) | - | - | - | none | B_recruiter | | |
| 10 | Override test | any | - | - | - | - | (templateOverride) | | |

---

## Test Matrix: Field Population

These tests verify that profile fields actually appear in the output (not just placeholders).

For each generated email, manually grep the response for:

| Field | Source | Test |
|-------|--------|------|
| `userFirstName` | Persona | Body must end with the user's first name. **NEVER** `[Your Name]`, `{{user_first}}`, or just "Best,". |
| `companyName` | Job | Subject OR body must contain the company name (case-insensitive). |
| `jobTitle` | Job | Subject OR body must contain the role or a clear paraphrase. |
| `recruiterFirstName` | Contact | Greeting must say `Hi <FirstName>,` (extracted from full name). |
| Story hook content | Profile | A1/A2 templates must reference the story hook substring (first ~20 chars). |
| Achievement content | Profile | Body must reference one of the user's achievements. |
| Portfolio URL | Profile | Template C body must include the portfolio URL. |
| Mutual name | Profile | Template D body must include the mutual's name in the first sentence. |
| Bio tone | Profile | Voice should match the bio (e.g. casual vs formal). |

---

## Test Matrix: Quality Scoring

Run each generated email through the quality rubric (returned in the response). Validate:

| Test | Expected behavior |
|------|-------------------|
| Generated email returns `qualityScore` in range 0-12 | ✓ |
| Generated email returns `qualityWarnings` array (may be empty) | ✓ |
| Successful template generations score ≥ 6 | ✓ |
| Generated email with banned phrase triggers a warning | ✓ |
| Generated email with `[Your Name]` triggers UNFILLED PLACEHOLDER warning AND score is reduced | ✓ |
| Generated email with word count outside 80-130 triggers warning | ✓ |
| Generated email without time-bound CTA triggers "No clear ask" warning | ✓ |

---

## Test Matrix: Anti-Pattern Detection

These phrases should NEVER appear in any successfully generated email. If they do, the lint pass should detect them and retry once.

| Banned phrase | Should be caught |
|---------------|------------------|
| "I hope this finds you well" | ✓ |
| "I'm writing to express my interest" | ✓ |
| "exciting opportunity" | ✓ |
| "passionate about" | ✓ |
| "I believe I would be a great fit" | ✓ |
| "thrilled" | ✓ |
| "eager" | ✓ |
| "to whom it may concern" | ✓ |
| "[Your Name]" | ✓ (placeholder) |
| "{{user_first}}" | ✓ (placeholder) |

---

## Test Matrix: Endpoint Coverage

| Endpoint | Test |
|----------|------|
| `POST /api/contacts/:id/generate-message` | Generates initial outreach (template auto-selected) |
| `POST /api/contacts/:id/generate-message` with `templateOverride` | Forces a specific template |
| `POST /api/contacts/:id/generate-followup` (no news) | Returns brief restated-fit follow-up |
| `POST /api/contacts/:id/generate-followup` (with `recentNews`) | Body references the recent news |
| `POST /api/contacts/:id/generate-thankyou` | Returns thank-you with interview details |
| `POST /api/contacts/:id/generate-rejection-grace` | Returns brief grace note under 80 words |

---

## Test Matrix: Edge Cases

| Edge case | Expected behavior |
|-----------|-------------------|
| User has empty profile (no bio, no resume, no hooks) | Falls back to B template, generates company-specific email from JD only |
| Job description is empty/missing | Generates fallback subject + body, returns `qualityScore` reflecting weakness |
| Resume > 1200 chars | Truncated to 1200 chars in profile context (no crash) |
| Subject line > 60 chars after generation | Auto-truncated with `...` |
| LinkedIn message > 300 chars | Auto-truncated with `...` |
| Claude API call fails | Fallback path returns hardcoded template, `qualityWarnings: ["Generation failed"]` |
| Special characters in name (e.g. "O'Brien") | Greeting renders correctly, no escaping issues |
| Recruiter name is just one word | Greeting still renders (`Hi <name>,`) |

---

## Test Matrix: Persona Differentiation Test

This is a "smell test" — generate 4 emails for the SAME job (Knack Growth PM) using all 4 personas, and verify they look meaningfully different. If they all look similar, personalization isn't actually working.

| Persona | Generated subject (first 50 chars) | Generated body opening (first 100 chars) | Visibly different from others? |
|---------|------------------------------------|------------------------------------------|--------------------------------|
| Kate | | | |
| Marco | | | |
| Avery | | | |
| Sam | | | |

If any two emails look 80%+ similar, the personalization layer is broken.

---

## How to Run the Tests

### 1. Seed the database

```bash
psql "$STAGING_DATABASE_URL" -f scripts/seed-test-personas.sql
```

This creates:
- 4 test users (`kate-test@sidedoor-test.com`, `marco-test@...`, etc.)
- 4 user_outreach_profiles (one per persona)
- 5 job_submissions
- 8 recruiter_contacts (2 per job)

### 2. Run the test script

```bash
bash scripts/test-message-generation.sh
```

This script:
- Logs in as each test persona
- Hits each generation endpoint
- Captures output to `test-results/<timestamp>/`
- Runs assertions for placeholder leaks, banned phrases, word count, field population
- Prints PASS/FAIL summary

### 3. Manual review

Open `test-results/<timestamp>/summary.html` to read the generated emails side by side. The persona differentiation test is best evaluated by a human.

### 4. Cleanup

```bash
psql "$STAGING_DATABASE_URL" -f scripts/cleanup-test-personas.sql
```

---

## Acceptance Criteria

The system passes if **ALL** of the following are true:

1. ✅ All 10 template selection scenarios fire the expected template
2. ✅ Zero generated emails contain `[Your Name]` or any other placeholder
3. ✅ Zero generated emails contain any phrase from the banned list
4. ✅ Every generated email has the contact's first name in the greeting
5. ✅ Every generated email has the company name in the subject or body
6. ✅ Every generated email has the user's first name in the signature
7. ✅ All 4 personas produce visibly different output for the same job
8. ✅ Template C emails include the actual portfolio URL
9. ✅ Template D emails include the mutual connection's name in the first sentence
10. ✅ Average `qualityScore` across all tests is ≥ 8/12
11. ✅ All 4 endpoints return 200 OK with the expected JSON shape
12. ✅ Edge case tests don't crash the server (all return 200 with fallback content)

If any of these fail, the system needs another iteration before shipping.
