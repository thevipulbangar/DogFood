# Data Model

Eight tables in `backend/db/schema.sql` (five T1 + three T2), plus
`password_reset_tokens` added by `backend/db/migrate.js`. Postgres, no ORM
— raw SQL via the `pg` client. `migrate.js` also carries `CREATE TABLE IF
NOT EXISTS` copies of the T2 tables so an already-running dev database
picks them up without a reset.

## Entity overview

```
users ──< team_members >── teams ──< submissions (1:1)
  │                          │            │
  └── events ─────────────────┘            │
users ──< password_reset_tokens            │
                                            │
events ──< rubric_criteria                 │
users ──< judge_assignments >── submissions ┘
judge_assignments ──< scores >── rubric_criteria
```

## `users`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | TEXT | |
| email | TEXT | UNIQUE |
| password_hash | TEXT | bcrypt, never the plain password |
| role | TEXT | CHECK constraint: `participant`, `judge`, `organizer`, `admin` |
| created_at | TIMESTAMPTZ | default `now()` |

Public `/api/auth/signup` always creates `participant` accounts. Judge and
organizer accounts are created by the admin (`POST /api/users`, admin-only
— see below) — never self-selected at signup. There is exactly one admin
account, created once by `db/seed.js`; a partial unique index,
`one_admin_only ON users ((role = 'admin')) WHERE role = 'admin'`, enforces
this at the database level (not just in the API), so even a direct SQL
`UPDATE ... SET role = 'admin'` on a second row fails.

## `events`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name, description | TEXT | |
| start_date, end_date | DATE | |
| submission_deadline | TIMESTAMPTZ | authoritative — checked server-side on every submission write |
| tracks | TEXT[] | e.g. `{AI/ML, Web, Hardware}` |
| prizes | TEXT | free text |

## `teams`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| event_id | FK → events | ON DELETE CASCADE |
| name | TEXT | |
| invite_code | TEXT | UNIQUE, `crypto.randomBytes(4)` hex — not guessable |
| created_by | FK → users | |

`GET /api/teams/me` is what a participant sees (their own team, joined with
the event's `tracks` as `event_tracks` so the submission form can offer the
organizer's actual configured tracks). `GET /api/teams` (organizer/admin
only, optional `?event_id=`) lists every team with its members and
submission status — the data behind the organizer's teams dashboard.

## `team_members`

Join table, `UNIQUE (team_id, user_id)` — a user can't join the same team
twice. No `role` column on membership (no "captain" concept enforced
server-side yet; `teams.created_by` stands in for that in the UI).

## `submissions`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| team_id | FK → teams | **UNIQUE** — one submission per team |
| title, description, track, repo_url, demo_url | TEXT | |
| is_draft | BOOLEAN | default `true`; flips to `false` on submit |
| submitted_at | TIMESTAMPTZ | set when locked |

A submission moves through three states: doesn't exist → draft (editable) →
submitted (`is_draft = false`, locked, visible in the public gallery). Every
write checks two things server-side: is the caller on this team, and is it
still before `events.submission_deadline`.

## `password_reset_tokens`

Added by `backend/db/migrate.js` (runs on every start; `schema.sql` only
runs once, on a fresh database). Stores a SHA-256 hash of the reset token,
never the raw token — the raw token only ever appears in the link handed
back to the user. Since this is a self-hosted stack with no external email
service, `/api/auth/forgot-password` logs the reset link server-side
(`docker compose logs backend`) instead of emailing it.

## `rubric_criteria`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| event_id | FK → events | ON DELETE CASCADE |
| name, description | TEXT | |
| weight | NUMERIC | `CHECK (weight > 0)`; expected to sum to 100 per event — checked in the API (`POST /api/judging/rubric`), not the database, so an organizer can add criteria one at a time |

## `judge_assignments`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| event_id | FK → events | ON DELETE CASCADE |
| judge_id | FK → users | ON DELETE CASCADE |
| submission_id | FK → submissions | ON DELETE CASCADE |
| status | TEXT | `pending` or `completed` |
| assigned_at, completed_at | TIMESTAMPTZ | |

`UNIQUE (judge_id, submission_id)` — created only by the round-robin
assignment algorithm (`POST /api/judging/assign`), never by a judge
themselves; re-running it is idempotent (`ON CONFLICT DO NOTHING`), so it
only fills gaps (e.g. a late-added judge) instead of duplicating rows.

## `scores`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| assignment_id | FK → judge_assignments | ON DELETE CASCADE |
| criterion_id | FK → rubric_criteria | ON DELETE CASCADE |
| raw_score | NUMERIC | `CHECK (raw_score >= 0 AND raw_score <= 10)` |
| notes | TEXT | optional |

`UNIQUE (assignment_id, criterion_id)` — one score per criterion per
assignment; a judge updates their own row until they call `POST
.../complete`, which locks the assignment (`status = 'completed'`) and
stops further score writes for it. See `JUDGING.md` for how raw scores
become weighted, normalized rankings.

## Import / export paths

- **Export:** `GET /api/gallery` returns submitted projects as JSON
  (`?q=` and `?track=` filters). `GET /api/judging/export.csv?event_id=&type=`
  (`type` is `results`, `assignments`, or `scores`) returns judging data as
  CSV, organizer/admin only.
- **Import:** none yet. `backend/db/seed.js` is the only way data enters a
  fresh instance today (4 role accounts, 1 event, 1 team, 1 submission, 4
  rubric criteria, 1 judge assignment).
