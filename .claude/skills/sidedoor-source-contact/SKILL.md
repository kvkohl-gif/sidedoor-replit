---
name: sidedoor-source-contact
description: Given a job posting (URL or pasted description), find the person who most likely owns the hire — the hiring manager first, a recruiter second — using the Apollo API, and return verified work emails for the top picks. Use when the user shares a job they are interested in and wants to know who to contact.
---

# Source the right contact for a job

The goal is one named person who most plausibly owns this hire, a backup, and a
recruiter, each with a reason. A short, honest list beats a long padded one.

All Apollo calls go through `python3 sidedoor/apollo.py` (run from the repo
root). You do the reading and judging; the script only fetches data.

## 1. Get the posting

- URL: fetch the page with whatever web tool is available. If the fetch fails or
  returns a shell with no description, ask the user to paste the description.
  Do not guess the contents of a posting you could not read.
- Pasted text: use it as is.

## 2. Write the job brief

Extract only what the posting states. Mark anything inferred as inferred.

- Company name (full brand name) and company domain. Take the domain from an
  email address, a company link, or the careers URL in the posting. An ATS URL
  (`boards.greenhouse.io/acme`, `jobs.lever.co/acme`, `jobs.ashbyhq.com/acme`)
  gives a slug, not a domain.
- Job title, seniority level, location, remote policy.
- Team or product area ("Growth", "Payments Platform", "Originations").
- Reporting line, if stated ("reports to the VP of Product").
- Any named person: recruiter, hiring manager, application contact.
- The three to five requirements that define the role.

## 3. Resolve the company

```
python3 sidedoor/apollo.py org --domain acme.com
python3 sidedoor/apollo.py org --name "Acme Health" --location "Boston, MA"
```

Prefer `--domain`. Use `--name` only when no domain is known, and add
`--location` to separate same-name organizations. Check that the returned name,
domain and description match the company in the posting. If nothing matches
with confidence, stop and tell the user; never continue with a lookalike.

Note `id`, `primary_domain` and `employees`.

## 4. Search broadly

Searching is cheap; revealing emails is not. Pull a wide pool, then judge.

```
python3 sidedoor/apollo.py people --org-id ID --departments ... --seniorities ... --per-page 50
python3 sidedoor/apollo.py people --org-id ID --titles "head of growth,director of product,..."
python3 sidedoor/apollo.py people --org-id ID --keywords "Jane Smith"
```

Run these passes and merge by `id`:

1. **Named person.** If the posting names someone, search for them by
   `--keywords`. A named contact found at the right company outranks everyone.
2. **Hiring-manager pool.** Filter by department and by seniority one to three
   levels above the role, with no title filter. Seniority values: `senior`,
   `manager`, `director`, `head`, `vp`, `c_suite`, `founder`, `owner`,
   `partner`. Department values are Apollo's (for example
   `master_engineering_technical`, `product_management`, `master_marketing`,
   `master_sales`, `master_operations`, `master_finance`,
   `master_human_resources`, `design`, `data_science`); if a department filter
   returns nothing, drop it and rely on titles.
3. **Title pass.** Five to eight titles you would expect this role's manager to
   hold, including the team or product-area word from the brief. Apollo titles
   match loosely, so short forms ("head of product") catch longer real titles.
4. **Recruiters.** Titles such as `recruiter`, `technical recruiter`,
   `talent acquisition`, `talent partner`, `head of talent`, `people partner`.

Adjust to company size:

- **50 or fewer employees:** the founder, CEO or CTO is usually the hiring
  manager. Search `--seniorities founder,c_suite,owner` and skip the recruiter
  pass unless one turns up.
- **51 to 500:** department head or director is the usual owner.
- **Over 500:** go for the manager or director of the specific team, and a
  recruiter aligned to that function. A VP is too far from the hire.

If the job is tied to a location and the pool is large, add `--locations`.
Use `--raw` on any command when a field you need is missing from the trimmed
view.

## 5. Rank the real candidates

Judge each person in the pool against the brief:

- Does the title cover the team or product area named in the posting?
- Is the seniority one or two levels above the role? Peers and people four
  levels up are weak picks.
- Does it match a stated reporting line? That settles it.
- Does location or business unit fit, at a company with several?
- Is the person still at the company, in this function?

Then choose:

- **Primary:** the most likely hiring manager.
- **Backup:** the next most likely, or the primary's manager.
- **Recruiter:** one, preferring a recruiter aligned to the role's function.

Give each a confidence of high, medium or low and a one-line reason grounded in
the posting. If nobody is a credible hiring manager, say so and present the
best available route (recruiter, or a department head as a referral ask). Do
not promote a weak match to fill a slot.

## 6. Reveal emails for the picks only

```
python3 sidedoor/apollo.py enrich --id ID1 --id ID2 --id ID3
```

This spends Apollo credits, so enrich at most three people per job unless the
user asks for more.

Accept an email only when both hold:

- `email_status` is `verified`, and
- the email's domain is the organization's `primary_domain` or an obvious
  sibling of it.

Otherwise report the person with "no verified email" and their LinkedIn URL.
Never construct an address from a naming pattern. If `NEVERBOUNCE_API_KEY` is
set, `python3 sidedoor/apollo.py verify --email ...` gives a second check for
anything Apollo marks as unverified or guessed.

Enrichment also returns the full name and employment history. Re-check the pick
against it: if the person has left the company or changed function, drop them
and take the next candidate.

## 7. Report and save

Show the user a short table: role in the outreach (primary, backup, recruiter),
name, title, email or "none verified", LinkedIn, confidence, reason. Then state
anything that could not be confirmed.

Save the brief and the picks to `sidedoor/runs/YYYY-MM-DD-company-role.md` so
the drafting skill can use them. That folder is ignored by git because it holds
other people's contact details.
