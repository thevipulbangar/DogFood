-- Runs automatically the first time the db container starts with an empty
-- data volume (Postgres's official image runs every .sql file it finds in
-- /docker-entrypoint-initdb.d, in filename order).

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant'
    CHECK (role IN ('participant', 'judge', 'organizer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exactly one admin, enforced by the database itself rather than just the
-- API: a partial unique index on a constant expression means at most one
-- row can ever satisfy `role = 'admin'` (a second INSERT/UPDATE trying to
-- set it hits a unique-violation, same as a duplicate email would). The
-- single admin is created once by db/seed.js; there is no signup path or
-- API endpoint that can create another one. See JUDGING.md / README.md.
CREATE UNIQUE INDEX one_admin_only ON users ((role = 'admin')) WHERE role = 'admin';

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  submission_deadline TIMESTAMPTZ NOT NULL,
  tracks TEXT[] NOT NULL DEFAULT '{}',
  prizes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

-- A password reset link is one row here: the raw token lives in the URL the
-- user clicks, only its hash is stored, and it stops working after use or
-- after expires_at.
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One submission per team: it starts as a draft the team edits, then locks
-- in with is_draft = false and submitted_at set.
CREATE TABLE submissions (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  track TEXT,
  repo_url TEXT,
  demo_url TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── T2: Judging ──────────────────────────────────────────────────────────

-- Weighted rubric criteria, configurable per event. Weights are expected
-- (checked in the API, not the database) to sum to 100 per event.
CREATE TABLE rubric_criteria (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC NOT NULL CHECK (weight > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which judge reviews which submission. Rows are created only by the
-- assignment algorithm (round-robin, see judging.js) — never by a judge
-- assigning themselves.
CREATE TABLE judge_assignments (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  judge_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (judge_id, submission_id)
);

-- One raw score per (assignment, criterion), scale 0-10. A judge can update
-- their own scores until the assignment is marked completed.
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES judge_assignments(id) ON DELETE CASCADE,
  criterion_id INTEGER NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  raw_score NUMERIC NOT NULL CHECK (raw_score >= 0 AND raw_score <= 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, criterion_id)
);
