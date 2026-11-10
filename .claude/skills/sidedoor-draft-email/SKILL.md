---
name: sidedoor-draft-email
description: Draft a cold outreach email from the user to the hiring manager or recruiter for a job, grounded in the user's real experience in sidedoor/profile.md. Use when the user pastes a job description or job link and asks for an outreach email, or after sidedoor-source-contact has picked a contact.
---

# Draft the outreach email

Usage: `/sidedoor-draft-email` followed by a pasted job description or a link.
The user may add who the email is for and where they applied.

## 1. Gather inputs

- **The job.** Use the pasted description. For a link, fetch it; if the fetch
  fails, ask for the text. If a matching file exists in `sidedoor/runs/`, use
  its brief and chosen contact.
- **The profile.** Read `sidedoor/profile.md`. Use only facts found there or in
  the posting. Never invent an achievement, a number, a connection, or a claim
  that the user uses the product.
- **The recipient.** In order: the person the user names; a person the posting
  names as hiring manager or as who the role reports to; otherwise ask the user
  who it is for, or offer to run `sidedoor-source-contact`. Do not draft to an
  unnamed "hiring manager".

Use the name the person uses for themselves in the posting ("Hi, I'm Geo"
means "Hi Geo"), even if LinkedIn shows a formal name.

## 2. Read the posting for three things

1. **What this person owns or is hiring for.** Team, product area, and the
   exact words used for the work (for example "AI memory and context"). If the
   posting covers several areas, pick the one the profile fits best and name it
   in the email.
2. **Traits they ask for** that the profile can show with a real example.
3. **Their process.** If the posting lists interview steps, the ask is the
   first step ("I'd welcome the intro call"), not a separate meeting.

## 3. Build the email

Follow the structure and voice in the profile's "Voice" and "Reference email"
sections. The default shape:

1. **Opening.** A short friendly line is fine if the profile's voice uses one.
   Then: applied for which role, through where if known, and that this is why
   the role matters to them.
2. **Why I care.** The user's real reason for wanting this company's problem,
   from the profile's story hooks. Pick the hook that fits this company. If
   none fits, open with a specific observation from the posting instead; do
   not stretch a hook to a company it does not match.
3. **Proof.** One paragraph on the most relevant work, described in the
   posting's own words where the match is real. One role, two or three
   specifics, numbers where the profile has them.
4. **Why now.** One or two sentences from the profile's "why I'm looking", if
   it helps explain the move.
5. **Close.** "My resume is attached." plus one ask. No second, vaguer ask.

Rules:

- 130 to 180 words in the body. Each paragraph does one job.
- Subject under 50 characters, naming the area or the hook. Not "Application
  for" or "Interested in".
- The first two paragraphs could not be sent to any other company.
- Describe work the way the resume does. Do not upgrade "led the build" to
  "built".
- Sign with the user's first name. No placeholders.
- Never use: "I hope this finds you well", "I'm writing to express my
  interest", "exciting opportunity", "passionate about", "I believe I would be
  a great fit", "thrilled", "eager", "to whom it may concern", and anything
  listed under "Never say" in the profile.

For a recruiter, shorten to: role and where applied, one proof paragraph
mapped to the top requirement, resume attached, and an easy ask with an out
("if you're not the right person, happy to be pointed to whoever is").

## 4. Check, then output

Check: every claim traces to the profile or posting; one ask; word count and
subject length in range; right name. Rewrite once if a check fails.

Output, in this order:

1. The subject in its own code block.
2. The body in its own code block, ready to copy.
3. Two or three lines: who it is addressed to and why, which story and proof
   were chosen and why, and anything the user should confirm or add (a number,
   a link, a missing recipient email).

If asked, add a LinkedIn note under 300 characters with its own wording.
Do not send anything; the user sends it.
