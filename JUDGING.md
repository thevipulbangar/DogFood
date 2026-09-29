# Judging

How T2 works: rubric scoring, judge assignment, cross-judge normalization,
and export. All of it is enforced server-side — the API rejects the wrong
role or the wrong judge with a `403`, not just a hidden UI element.

## Rubric

An organizer/admin defines weighted criteria per event
(`POST /api/judging/rubric`, `rubric_criteria` table). Each criterion has a
`weight` (expected to sum to 100 across an event's criteria — this is
checked in the API, not the database, so an organizer can add criteria one
at a time without every intermediate state being valid). A judge scores
each criterion 0–10; the weighted total for one judge's scoring of one
submission is:

```
weighted_total = Σ (raw_score_i / 10 * weight_i)   for each criterion i
```

which lands on a 0–100 scale matching the weights.

## Judge invitation

Judges (and organizers) are never self-registered — public signup
(`POST /api/auth/signup`) always creates a `participant`. The admin
creates judge and organizer accounts directly (`POST /api/users`,
admin-only, from `/admin` in the UI): a name, email and temporary
password, with the role restricted to `judge` or `organizer` — the
endpoint rejects `admin` outright, and the database backs that up with a
partial unique index (`one_admin_only`) so there is exactly one admin
account for the life of the instance. That single admin is the only
account that can invite judges, which keeps "who gets to grade
submissions" a deliberate, auditable decision rather than something a
participant could self-grant.

## Assignment: round-robin

An event must have at least one rubric criterion before judges can be
assigned to it — `POST /api/judging/assign` refuses with a `400` otherwise
(`this event has no rubric criteria yet`), and `POST
/assignments/:id/complete` independently re-checks the same thing before
letting a judge complete a review, in case criteria were somehow removed
after assignment. Without this, an event with an empty rubric would let a
judge "complete" a review with nothing to score, producing a silent,
meaningless all-zero result rather than an error.

`POST /api/judging/assign` (organizer/admin only) assigns every submitted
(non-draft) project to `judges_per_submission` judges (default 3, or fewer
if there aren't that many judges). It walks submissions in order and, for
each one, takes the next `n` judges starting from a rotating cursor:

```
for each submission:
  assign judges[cursor .. cursor+n-1]  (wrapping around)
  cursor += n
```

This spreads assignments evenly rather than always starting from judge #1
(which would overload the first few judges). The insert is
`ON CONFLICT (judge_id, submission_id) DO NOTHING`, so the whole operation
is idempotent — running it again after adding a late judge or a late
submission only fills the gaps, it never duplicates an assignment or
disturbs one that's already in progress.

Judges never self-select what they review; only an organizer/admin can
trigger assignment.

## Scoring: ownership-only, no admin override

A judge sees only their own assignments (`GET /api/judging/my-assignments`)
and can only read or write scores for an assignment that's theirs
(`assignment.judge_id === req.user.id`) — enforced on every read and write
in `backend/src/routes/judging.js`, not just in the UI. This is a
deliberate design choice: **not even an admin can submit or edit a score on
a judge's behalf.** An admin can see aggregate results and trigger
re-assignment, but the actual scoring integrity — this judge, this
submission, this number — is never mutable by anyone else. If a judge's
score needs to change, the only path is the judge revisiting their own
still-open assignment before they submit; once `POST
/assignments/:id/complete` is called the assignment locks.

Scores can be saved as a draft (`POST /assignments/:id/scores`, callable
repeatedly, one row per criterion via `UNIQUE (assignment_id,
criterion_id)`) before being finalized with `POST
/assignments/:id/complete`, which requires every rubric criterion to have a
score and flips `status` to `completed`.

## Normalization: per-judge z-score

Different judges score differently — some are harsh, some generous, some
use the full 0–10 range and some cluster around 6–8. Averaging raw scores
directly lets a strict judge's 5/10 count against a project just as much as
a lenient judge's 5/10, even though they mean different things. To correct
for this, each judge's completed weighted totals are converted to
z-scores relative to that judge's own mean and standard deviation before
being averaged across judges:

```
z = (weighted_total - judge_mean) / judge_stddev
```

`GET /api/judging/results` computes, per submission: the raw average across
judges (`raw_avg`, for reference/sanity-checking), the normalized average
(`normalized_avg`, the actual ranking number — the mean of each
contributing judge's z-score for that submission), and `fully_normalized`
(`false` if any contributing judge's score used the fallback below, so a
result that's still partly raw-score-based is visible rather than silently
blended in).

**Documented edge case:** a judge with fewer than 2 completed scores, or
whose completed scores are all identical (zero variance, so `stddev = 0`),
cannot be meaningfully normalized — dividing by a zero or undefined stddev
either explodes or is undefined. For that judge, their raw weighted total
is used directly in place of a z-score for that one contribution, rather
than distorting the average with an undefined value or arbitrarily zeroing
them out. In practice this only matters early in judging (a judge who's
completed 0 or 1 scores so far) or for a very small judge pool; it
self-resolves as more scores come in, and the organizer console flags any
result that isn't `fully_normalized` yet.

## Export

`GET /api/judging/export.csv?event_id=&type=` (organizer/admin only, `type`
is `results`, `assignments`, or `scores`) returns the corresponding table
as CSV. The frontend can't just link to this directly — the endpoint
requires the same `Authorization: Bearer <jwt>` header as every other
API call, and a plain `<a href>` can't attach one — so
`frontend/lib/api.ts`'s `downloadCsv()` fetches the CSV with the header
attached and triggers the browser download client-side via a `Blob`.

## Community voting (T3) vs. judging — kept deliberately separate

Community votes and judge scores are two independent signals and are
never merged into one number. Judges and organizers cannot cast votes
(`requireRole("participant")` on `POST /api/voting/:id/vote`) — the
people scoring a project on the rubric shouldn't also be moving its
crowd-popularity count. `GET /api/voting/results` and
`GET /api/judging/results` are separate endpoints, shown side by side on
the Results page, and it's left to a human organizer to weigh them,
rather than the platform silently blending "how the crowd liked it" into
"how it scored on the rubric."

Vote integrity (one vote per project per voter via a database unique
constraint, a per-voter rate limit, hidden results until published, and
an audit trail of every vote/rejection) is covered in full in
`THREAT_MODEL.md`, which also documents what's explicitly *not*
defended against (Sybil accounts, primarily) rather than implying more
coverage than actually exists.

Voting is configurable per event, not a single global on/off switch:
`events.voting_open` (default `true`) lets an organizer close voting
entirely (e.g. once judging starts), and `events.vote_rate_limit`
(default `10`/minute) lets them raise or lower the per-participant rate
limit instead of it being one hardcoded constant for every instance.
Both are editable from the event form at `/admin`.

## API summary

| Endpoint | Role | Purpose |
|---|---|---|
| `POST /api/users` | admin only | create a judge or organizer account |
| `GET /api/users` | admin only | list accounts, optional `?role=` filter |
| `POST /api/judging/rubric` | organizer/admin | replace an event's rubric criteria |
| `GET /api/judging/rubric?event_id=` | any authenticated user | read an event's rubric |
| `POST /api/judging/assign` | organizer/admin | round-robin assign judges to submitted projects |
| `GET /api/judging/assignments?event_id=` | organizer/admin | all assignments for an event |
| `GET /api/judging/my-assignments` | judge | the caller's own assignments |
| `GET /api/judging/assignments/:id` | the assigned judge, or organizer/admin | one assignment's detail: submission, rubric, existing scores |
| `POST /api/judging/assignments/:id/scores` | the assigned judge only | save/update draft scores |
| `POST /api/judging/assignments/:id/complete` | the assigned judge only | lock in the score |
| `GET /api/judging/results?event_id=` | organizer/admin | normalized rankings per submission |
| `GET /api/judging/export.csv?event_id=&type=` | organizer/admin | CSV export |
| `GET /api/voting/feed?event_id=` | participant | randomized list of votable submissions |
| `POST /api/voting/:id/vote` | participant | cast one vote (rate-limited, one per submission) |
| `GET /api/voting/:id/comments`, `POST .../comments` | any authenticated user | read/post comments |
| `GET /api/voting/results?event_id=` | any authenticated user (staff bypass the publish gate) | vote counts, hidden until published |
| `POST /api/voting/publish` | organizer/admin | publish or unpublish vote results |
| `GET /api/audit?limit=` | organizer/admin | recent audit log entries |
