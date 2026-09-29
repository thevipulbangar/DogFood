# Architecture

A plain-English tour of every file in `backend/`, in the order you'd read them.

## Running it

```bash
docker compose up --build
```

That's the whole setup. Three containers start:

- **db** — Postgres. On its very first start (empty database), it runs
  `backend/db/schema.sql` automatically to create the tables.
- **backend** — an Express API on port 8000. Before it starts listening, it
  runs `backend/db/migrate.js` (adds any tables missing from an
  already-running instance) then `backend/db/seed.js` to create some sample
  data (skipped if that data already exists, so restarting the stack doesn't
  duplicate it).
- **frontend** — the Next.js app on port 3000.

Check it's alive: `curl http://localhost:8000/health` → `{"status":"ok"}`.

## `docker-compose.yml`

Describes the three containers above, how they're built, which ports they
expose on your machine, and the order they start in. `depends_on: db:
condition: service_healthy` makes the backend wait for Postgres to actually
be ready to accept connections (via a `pg_isready` healthcheck), not just
"container started."

## `backend/db/schema.sql`

The database's table definitions, run once by Postgres itself on first
start. Eight tables:

- **users** — has a `role` column that can only be `participant`, `judge`,
  `organizer`, or `admin` (enforced by a `CHECK` constraint in the database
  itself, as a second line of defense beyond the API code). A partial
  unique index, `one_admin_only`, additionally guarantees there is never
  more than one `admin` row — see `JUDGING.md`.
- **events** — a hackathon event: dates, a `submission_deadline`, a list of
  `tracks`, and `prizes`.
- **teams** — belongs to one event, has a unique `invite_code` other people
  use to join it.
- **team_members** — who's on which team (a many-to-many join table).
- **submissions** — one per team (enforced by `UNIQUE (team_id)`). Starts as
  a draft (`is_draft = true`); flips to `false` with a `submitted_at`
  timestamp once the team locks it in.
- **password_reset_tokens** — one row per "forgot password" request. Stores
  a *hash* of the reset token (never the raw token — same idea as never
  storing a raw password), plus when it expires and whether it's been used.
- **rubric_criteria**, **judge_assignments**, **scores** — T2 judging.
  See `DATA-MODEL.md` and `JUDGING.md` for the full schema and methodology.

## `backend/db/migrate.js`

A tiny, hand-rolled migration: idempotent `CREATE TABLE IF NOT EXISTS` /
`CREATE UNIQUE INDEX IF NOT EXISTS` statements that run on every backend
start, so an instance that was already running before a table or index
existed gets it added automatically (`schema.sql` only runs once, on a
brand-new empty database). Covers `password_reset_tokens`, the three T2
judging tables, and the `one_admin_only` index. If the schema needs to
change existing columns later rather than just add tables, swap this for a
real migration tool.

## `backend/db/seed.js`

Runs on every container start, but checks first whether the seed
`organizer@dogfood.dev` user already exists — if so it does nothing, so
restarting the stack is safe. Creates one user per role (password
`password123` for all of them), one event, one team, and one already-
submitted project (so the public gallery has something to show).

## `backend/src/db.js`

One shared Postgres connection ("pool") that every route reuses, instead of
each file opening its own connection.

## `backend/src/auth.js`

Three building blocks used everywhere else:

- `signToken(user)` — creates a JWT (a signed token) containing just the
  user's `id` and `role`. That token is what the frontend stores and sends
  back on every request afterwards.
- `requireAuth` — Express middleware that reads the `Authorization: Bearer
  <token>` header, checks it's a valid token, and attaches the decoded
  `{ id, role }` as `req.user`. Rejects with `401` if the token is missing
  or invalid.
- `requireRole(...roles)` — middleware you chain after `requireAuth`. E.g.
  `requireRole("organizer", "admin")` lets only those two roles through and
  sends everyone else a `403`.

## `backend/src/asyncHandler.js`

A small technical necessity: Express 4 doesn't automatically catch errors
thrown inside an `async` route handler (a database error would otherwise
just hang the request forever with no response). `asyncHandler(fn)` wraps a
handler so any error it throws gets turned into a proper `500` response
instead.

## `backend/src/routes/auth.js`

- `POST /api/auth/signup` — hashes the password with bcrypt (never stores
  the plain password), inserts the user, returns a token. Always creates a
  `participant` account, even if the request body includes a `role` field —
  self-registering as `admin` isn't something a public form should allow.
- `POST /api/auth/login` — looks up the user by email, compares the
  password against the stored hash, returns a token.
- `POST /api/auth/forgot-password` — takes an `email`. If an account exists
  for it, generates a random token, stores its hash with a 1-hour expiry,
  and (since this self-hosted stack deliberately has no SMTP server) logs
  the reset link to the backend's console instead of emailing it — check
  `docker compose logs backend` for it. Always returns the same response
  either way, so this endpoint can't be used to check which emails have
  accounts (a common security requirement for this kind of endpoint).
- `POST /api/auth/reset-password` — takes the `token` from that link plus a
  new `password`. Rejects if the token is missing, wrong, expired, or
  already used once.

## `backend/src/routes/events.js`

- `GET /api/events` — any logged-in user (any role) can list events.
- `POST /api/events` / `PUT /api/events/:id` — only `organizer` or `admin`
  (enforced by `requireRole`).

## `backend/src/routes/teams.js`

- `GET /api/teams/me` — the logged-in user's own team, its members, and its
  submission (or all `null` if they're not on one yet). Also returns the
  event's `tracks` (as `event_tracks`) so the submission form can show the
  organizer's actual configured tracks instead of a hardcoded list.
- `GET /api/teams` — organizer/admin only: every team for an event (or all
  events, if `?event_id=` is omitted), each with its members and submission
  status. Powers the organizer's teams dashboard.
- `POST /api/teams` — any logged-in user creates a team for an event and is
  automatically added as its first member. A random invite code is
  generated (`crypto.randomBytes`, not `Math.random` — it's not guessable).
- `POST /api/teams/join` — anyone can join a team if they know its code.

## `backend/src/routes/submissions.js`

The one route with real business logic: a helper called `getMyTeam` looks up
whether the logged-in user is on the given team, and joins in the team's
event so we know the `submission_deadline` in the same query. Every write
(`POST /`, `PUT /:id`, `POST /:id/submit`) checks two things before touching
the database: **is this your team?** and **is it still before the
deadline?** If either check fails, it's a `403`.

## `backend/src/routes/gallery.js`

`GET /api/gallery` — no login required. Only returns submissions where
`is_draft = false`. Supports `?q=` (searches title/description) and
`?track=` as optional filters, both applied as SQL `WHERE` conditions built
up dynamically.

## `backend/src/routes/judging.js`

T2: rubric management, round-robin judge assignment, ownership-locked
scoring, z-score normalization, and CSV export. See `JUDGING.md` for the
full methodology — this file is deliberately documented there instead of
duplicated here.

## `backend/src/routes/users.js`

Admin-only account creation: `POST /api/users` creates a judge or organizer
account (never `admin` — rejected outright), `GET /api/users` lists
accounts with an optional `?role=` filter. This is the only way a judge or
organizer account comes to exist; public signup always creates a
participant. See `JUDGING.md`'s "Judge invitation" section.

## `backend/src/routes/stats.js`

`GET /api/stats` — public, aggregate-only counts (event/team/submission
totals) for the marketing homepage's live numbers. No per-record data, no
auth required; this replaced a set of hardcoded fake counters that used
to live directly in the frontend.

## `backend/src/routes/voting.js`

T3: community voting, comments, and publish-gated results. See
`JUDGING.md`'s "Community voting (T3) vs. judging" section and
`THREAT_MODEL.md` for the abuse model. Rate limiting and duplicate-vote
rejection both write to `audit_log` via `src/audit.js`.

## `backend/src/routes/audit.js`

`GET /api/audit` (organizer/admin only) — read-only view over the
append-only `audit_log` table, newest first, capped at `?limit=` (max 500).

## `backend/src/audit.js`

`logAudit(actorId, action, object, metadata)` — a small helper used from
`voting.js`, `users.js`, and `judging.js` to append one row to
`audit_log`. Never throws into its caller (a logging failure shouldn't
fail the action it's logging) — errors are caught and just logged to the
server console.

## `backend/db/reset.js`

`npm run reset` — truncates every table and re-runs `seed.js`. Exists
because the integration test suite makes real HTTP requests against
whatever database the backend is pointed at, and the default
`docker-compose` setup has no separate throwaway test database, so
running `npm test` leaves real test data behind. Run this before a demo
or before handing the instance to a judge.

## `backend/src/index.js`

Wires all of the above together: creates the Express app, mounts each
router under its `/api/...` prefix, and adds one final error-handling
middleware that turns any uncaught error into a JSON `500` instead of a
stack trace.

## `backend/tests/`

Integration tests using Node's built-in test runner (`node --test`) — no
extra testing library needed. They make real HTTP requests against a
running backend (so `docker compose up` must already be running), split
across files by area:

- **api.test.js** — the 4 seeded users can log in, the seeded project shows
  up in the public gallery, a `participant` gets `403` creating an event, a
  submission after the deadline is rejected.
- **judging.test.js** — rubric weighted scoring, round-robin assignment
  idempotency, ownership-only scoring (a judge can't touch another judge's
  assignment, verified against a second real judge created via SQL), and
  results normalization.
- **users.test.js** — only the admin can create judge/organizer accounts,
  the API refuses to create a second admin, duplicate emails are rejected.
- **teams.test.js** — organizer/admin can list all teams with members and
  submission status; a participant gets `403`.
- **voting.test.js** — one vote per submission enforced (duplicate
  rejected `409`), can't vote for your own team, judges/organizers can't
  vote (`403`), results hidden from participants until published,
  comments readable/postable by any role, and the audit log records both
  a cast vote and a rejected duplicate.

Run them with `npm test` (from `backend/`, against a running stack) or, if
`node_modules` isn't installed on your host, `docker compose exec backend
npm test`.

## Frontend

Next.js app router, one directory per role-visible page under
`frontend/app/(app)/`. Real, backend-backed pages/components are named
`Real*` (e.g. `RealGallery`, `RealProjectDetail`, `RealJudgingOps`,
`RealJudgeDashboard`, `RealEventManager`, `RealTeamsTable`,
`RealUserManagement`, `RealVotingBoard`, `RealResults`, `RealAuditLog`).
Every page reachable from the sidebar nav is now real/backend-backed as
of this write-up. `Analytics.tsx` and `Certificates.tsx` were rewritten
to honest "not implemented" placeholders rather than fabricated data —
Analytics has no corresponding tier requirement at all, Certificates is
an unimplemented T4 stretch item. A handful of components under
`components/landing/experience/` still use `lib/data.ts` for the
marketing homepage's stylized scroll narrative (an illustrative product
story, not live application data — the actual gallery/results/dashboard
pages it links to are all real); the plain (non-`experience`) landing
components (`Marquee`, `PlatformReveal` in `Sections.tsx`) were converted
to fetch real data (`GET /api/gallery`, `GET /api/stats`) even though
they aren't the ones currently rendered by `app/page.tsx`, so they're
correct if ever swapped back in.
