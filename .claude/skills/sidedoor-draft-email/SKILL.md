---
name: sidedoor-draft-email
description: Draft a short, specific cold outreach email (and a LinkedIn note) from the user to a chosen contact about a specific job, grounded in the user's real experience from sidedoor/profile.md. Use after sidedoor-source-contact has picked a contact, or when the user names a contact and a job and asks for an outreach draft.
---

# Draft the outreach email

## Inputs

- **The job brief and the chosen contact.** From the latest matching file in
  `sidedoor/runs/`, or from the conversation.
- **The user's profile.** Read `sidedoor/profile.md`. If a
  `sidedoor-positioning` skill is available, load it as well. If the profile is
  still the unfilled template, ask the user for a resume or a few lines on
  their background before drafting; a draft with no real experience behind it
  is not worth sending.

Use only facts from the profile and the posting. Never invent an achievement,
a metric, a mutual connection, or a claim that the user uses the product.

## Pick the angle

Take the first that applies:

1. **Mutual connection.** The profile lists someone who knows the contact or
   works at the company. Lead with them.
2. **Relevant work product.** The user has built something in this company's
   domain. Lead with it and link it.
3. **Recruiter.** The contact is in recruiting or HR. Lead with qualifications
   mapped to the top requirement.
4. **Personal connection to the domain.** The user has an origin story or is a
   real customer or user. Open with it, for a hiring manager.
5. **Default for a hiring manager.** Open with a specific observation about the
   team's work taken from the posting.

## Write it

Hiring manager, peer to peer:

1. Observation or personal hook tied to their team (one or two sentences).
2. One proof point: the single achievement most relevant to the top
   requirement, with its number.
3. Why this role fits where the user is headed (one sentence).
4. A small, specific ask: a 15-minute conversation.

Recruiter:

1. The role, and one sentence on why this company.
2. One proof point mapped to the top requirement.
3. An easy ask, with an out: "if you're not the right person, happy to be
   pointed to whoever is."

Rules:

- 80 to 130 words in the body. Under 100 for a mutual-connection email.
- Subject under 50 characters, naming the team, domain or hook. Not
  "Application for" or "Interested in".
- Greet by first name. Sign with the user's first name.
- Say why this person: the reason from the sourcing step, in plain words
  ("you lead the growth team this role sits in").
- Match the voice notes in the profile.
- No placeholders left in the text.
- Never use: "I hope this finds you well", "I'm writing to express my
  interest", "exciting opportunity", "passionate about", "I believe I would be
  a great fit", "thrilled", "eager", "to whom it may concern".

LinkedIn note: under 300 characters, its own wording, ending in a question.

## Check before showing it

- Every claim traces to the profile or the posting.
- The first sentence could not be sent to any other company.
- There is exactly one proof point and exactly one ask.
- Word count and subject length are in range.

Rewrite once if any check fails.

## Output

Show the subject, the email and the LinkedIn note, then one line on the angle
chosen and why. Append the draft to the run file in `sidedoor/runs/`. Do not
send anything; the user sends it themselves.
