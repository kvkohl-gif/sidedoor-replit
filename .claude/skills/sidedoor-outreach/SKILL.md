---
name: sidedoor-outreach
description: End to end — take one or more job links or pasted job descriptions, find the right person to contact for each via Apollo, and draft a tailored email to them. Use when the user drops job links and wants contacts plus drafts in one pass.
---

# Job link to contact to draft

For each job the user gives:

1. Run the `sidedoor-source-contact` skill to produce the job brief and the
   picks (primary, backup, recruiter).
2. Show the picks. If the primary's confidence is low, or no verified email was
   found, say so and ask whether to draft anyway, try the backup, or stop.
   Otherwise continue.
3. Run the `sidedoor-draft-email` skill for the primary contact. Draft for the
   recruiter as well only if the user asks.

With several jobs, finish sourcing for all of them first and show one summary
table, so the user can drop any before drafts are written. Keep Apollo
enrichment to three people per job.

End with, per job: who to contact and why, the email address or the LinkedIn
fallback, the draft, and anything that could not be confirmed.
