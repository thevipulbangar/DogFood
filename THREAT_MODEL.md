# Threat model — voting and submission abuse

Scope: the T3 community voting system and the T1 submission pipeline it
depends on. Written against what is actually implemented in
`backend/src/routes/voting.js`, `submissions.js`, and the `votes` /
`comments` / `audit_log` tables — not aspirational.

## 1. Sybil voting (one person, many accounts)

**Attack:** create N participant accounts (signup requires only an email
and password, no verification) to cast N votes for one project.

**Mitigation in this build:**
- Only `participant` role accounts can vote at all — judges/organizers
  are excluded by `requireRole("participant")`.
- Each vote is tied to `voter_id`, and a voter can't vote for their own
  team's submission.

**Not mitigated:** nothing stops one person from registering multiple
participant accounts. There's no email verification, CAPTCHA, device
fingerprinting, or IP-based correlation.

**What a production deployment should add:** email verification before
an account can vote; optionally, gate voting eligibility on the account
having an actual team/submission of its own (raises the cost of a fake
account beyond one signup form); IP/device heuristics as a *signal* fed
into the audit log for a human to review, never an automatic ban (false
positives on shared campus/office networks are common at a hackathon).

## 2. Ballot stuffing (one account, many votes)

**Attack:** script one account to spam `POST /api/voting/:id/vote`.

**Mitigation:** a database `UNIQUE (submission_id, voter_id)` constraint
makes a second vote for the *same* project physically impossible — the
insert fails with a Postgres unique-violation (code `23505`), caught and
returned as `409`, and logged as `VOTE_REJECTED_DUPLICATE`. Separately, a
per-voter rate limit (10 votes/minute, checked against `votes.created_at`
before every insert) caps how fast one account can vote across
*different* projects, and a request over the limit is logged as
`RATE_LIMIT_TRIGGERED`.

**Residual risk:** 10 votes/minute is generous enough for a real user
clicking through a gallery, but a determined script could still spread
votes across many projects within that budget. The audit log makes this
visible after the fact (a burst of `VOTE_CAST` events from one
`voter_id` in a short window) even though it isn't auto-blocked beyond
the rate cap.

## 3. Submission scraping

**Attack:** bulk-download every project's repo/demo links and
descriptions from the public, unauthenticated `GET /api/gallery`.

**Position:** not mitigated, and deliberately not — the spec requires a
*public, searchable* gallery. Scraping public data that's meant to be
public isn't abuse. What *would* be abuse — scraping draft submissions —
isn't possible: `GET /api/gallery` and `GET /api/gallery/:id` both filter
`WHERE submissions.is_draft = false` at the query level, so a draft is
never reachable through either endpoint regardless of role or auth.

## 4. Judge collusion / judge self-dealing

**Attack:** a judge scores a friend's team favorably, or an organizer
manually edits scores after the fact.

**Mitigation:**
- Judge assignment is algorithmic (round-robin), not self-selected — a
  judge cannot request or pick which submissions they review.
- Score ownership is judge-only: `PUT` on a score checks
  `assignment.judge_id === req.user.id`, and there is no endpoint,
  including for the admin role, that lets anyone edit a score on a
  judge's behalf. See `JUDGING.md` for the full write-up.
- Cross-judge normalization (z-score) reduces the impact of one lenient
  or harsh judge on the final ranking versus using raw scores directly.

**Not mitigated:** nothing currently detects two judges whose scoring
patterns correlate suspiciously (a sign of coordination), or flags a
judge who is also a participant's teammate/friend. At hackathon scale
this is normally caught by a human organizer reviewing the results
table, not automated — the per-judge breakdown in
`GET /api/judging/results` and the audit log (`JUDGES_ASSIGNED` entries)
are the surface an organizer would use to spot it.

## 5. Deadline gaming

**Attack:** submit at the last second to avoid feedback/copying, or
attempt to submit/edit after the deadline by racing the clock.

**Mitigation:** every write to a submission (`POST /api/submissions`,
`PUT /:id`, `POST /:id/submit`) re-checks
`new Date() > event.submission_deadline` server-side, using the
server's own clock — never a client-supplied timestamp, and never a
value trusted from the request body. A request that lands after the
deadline is rejected with `403` even if it was *sent* before the
deadline but arrived after (no grace window).

## What's genuinely out of scope

- Vote *weighting* by account age/reputation — everyone's vote counts
  equally, which is simple but doesn't distinguish a long-standing
  community member from a same-day signup.
- CAPTCHA or proof-of-work on signup/voting.
- Automated anomaly detection beyond the rate limit + audit log (i.e. no
  ML-based fraud scoring). At hackathon scale, a human reading the audit
  log is the intended defense, not an automated system.
