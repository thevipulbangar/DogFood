# Dogfood 2026 — Hackathon Submission & Judging Platform

An open-source, self-hostable platform for running a hackathon end to end:
registration, team formation, project submissions, and (soon) judging. Built
for the [Dogfood 2026](https://dogfoodhack.com) hackathon, whose own
challenge was "build the platform that will judge you."

## Quick start

```bash
docker compose up --build
```

That's it — one command. It starts three containers (Postgres, the API,
and the web app), creates the database schema on first run, and seeds it
with sample data. No cloud account, hosted database, external API, or
network connection required — it works with your WiFi off once the images
are built.

- Web app: http://localhost:3000
- API: http://localhost:8000 (health check: `GET /health`)

### Try it immediately

Sign in with any of the four seeded accounts (password `password123` for
all of them):

| Email | Role |
|---|---|
| `participant@dogfood.dev` | Participant |
| `judge@dogfood.dev` | Judge |
| `organizer@dogfood.dev` | Organizer |
| `admin@dogfood.dev` | Admin |

The admin account can create judge and organizer accounts from
`/admin` — that's the only way one comes to exist (public signup always
creates a participant), and there's deliberately only ever one admin.

## What's implemented

**T1 — Core (done):**
- Authentication (signup/login, bcrypt + JWT) and password reset
- Four roles (participant/judge/organizer/admin), enforced server-side —
  the wrong role gets a `403` from the API itself, not just a hidden button
- Event creation and editing with dates, configurable tracks, and prizes
  (organizer/admin only, at `/admin` — a real form, not just an API)
- Team formation via invite codes, plus an organizer-facing teams
  dashboard (every team, members, submission status)
- Project submission: draft, autosaving edits, and a locking "submit"
  action, all with the deadline enforced server-side; the track picker on
  the submission form reflects the event's actual configured tracks
- A searchable, public project gallery (`GET /api/gallery`, `?q=` and
  `?track=` filters)

**T2 — Judging (done):**
- Weighted rubric criteria, configurable per event (organizer/admin only)
- Round-robin judge assignment (`POST /api/judging/assign`), idempotent —
  re-running it only fills gaps, never duplicates an assignment
- A judge dashboard showing only that judge's own assigned submissions,
  with a progress meter
- A scoring form (0-10 per criterion, notes optional) with a "save draft"
  vs. "submit" distinction — a submitted score locks
- Ownership-enforced scoring: a judge can only score their own
  assignments; not even an admin can score on a judge's behalf (see
  `JUDGING.md`)
- Admin-only account creation for judges and organizers
  (`POST /api/users`) — public signup only ever creates participants, and
  there is exactly one admin account, enforced by a database constraint,
  not just the API
- Cross-judge score normalization (z-score) so judges with different
  scoring habits don't skew rankings, with a documented fallback for
  judges with too little data to normalize
- An organizer console: trigger assignment, view live normalized
  results, export results/assignments/scores as CSV

See `JUDGING.md` for the judging methodology in detail.

**T3 — Public (done):**
- Community voting: one vote per project per voter (database unique
  constraint), participants only — judges/organizers can't vote, and you
  can't vote for your own team
- Comments on any submission, any authenticated role
- Results hidden until an organizer explicitly publishes them
  (`POST /api/voting/publish`) — separate from, and never mixed with,
  judging scores
- Randomized voting order, a per-voter rate limit, and an append-only
  audit trail of votes/rejections/rate-limits/account creation/judge
  assignment (`GET /api/audit`, organizer/admin only)
- Full abuse-model write-up, including what's explicitly NOT defended
  against, in `THREAT_MODEL.md`

**T4 — Stretch (partial):**
- The embeddable gallery widget (`/embed`) is real, backed by `GET /api/gallery`.
- Full OpenAPI 3.0 spec covering every endpoint: `openapi.yaml` in the
  repo root, also served live at `GET /api/openapi.yaml`. Every UI action
  goes through this same REST API — nothing server-side-only.
- Certificate generation, signed judge records, and bulk import/export
  are not implemented — see `acceptance-report.txt` for the honest gap list.

## Project layout

```
backend/    Node.js + Express + PostgreSQL API
frontend/   Next.js app
docker-compose.yml
```

See `ARCHITECTURE.md` for a file-by-file tour of the backend, and
`DATA-MODEL.md` for the database schema.

## Running tests

```bash
docker compose exec backend npm test
```

Integration tests against the live API: seeded accounts can log in, the
seeded project appears in the public gallery, the wrong role is rejected
with `403`, and a submission after the deadline is rejected.

These are real HTTP requests against whatever database the backend is
currently pointed at — there's no separate throwaway test database in the
default `docker compose` setup. That means running the suite creates real
teams, submissions and events, and they'll show up in the gallery and
admin panels alongside the fixture data. Restore a clean, fixture-only
state with:

```bash
docker compose exec backend npm run reset
```

This truncates every table and re-runs the seed script. Do this before
recording the demo video or handing the instance to a judge.

## License

MIT — see `LICENSE`.
