// Runs before seed.js on every backend start. schema.sql only runs once,
// the first time the db container's data volume is empty — this covers
// adding a table to an instance that's already been running.
// ponytail: hand-rolled + idempotent (CREATE TABLE IF NOT EXISTS), fine for
// one additive table; reach for a real migration tool (node-pg-migrate) if
// the schema starts changing existing columns instead of just adding.

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

for (let i = 0; ; i++) {
  try {
    await pool.query("SELECT 1");
    break;
  } catch (err) {
    if (i >= 9) throw err;
    console.log(`migrate: waiting for database... (${i + 1}/10)`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

await pool.query(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS rubric_criteria (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    weight NUMERIC NOT NULL CHECK (weight > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS judge_assignments (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    judge_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT \'pending\' CHECK (status IN (\'pending\', \'completed\')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE (judge_id, submission_id)
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES judge_assignments(id) ON DELETE CASCADE,
    criterion_id INTEGER NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
    raw_score NUMERIC NOT NULL CHECK (raw_score >= 0 AND raw_score <= 10),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (assignment_id, criterion_id)
  )
`);

// Partial unique index enforcing "at most one admin" at the database
// level (see schema.sql) — safe to (re)run on an already-migrated
// database via IF NOT EXISTS, same as the CREATE TABLE calls above.
await pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS one_admin_only
    ON users ((role = 'admin')) WHERE role = 'admin'
`);

// ── T3: public voting, comments, audit trail ──────────────────────────────

await pool.query(`
  ALTER TABLE events ADD COLUMN IF NOT EXISTS results_published BOOLEAN NOT NULL DEFAULT false
`);

await pool.query(`
  ALTER TABLE events ADD COLUMN IF NOT EXISTS voting_open BOOLEAN NOT NULL DEFAULT true
`);
await pool.query(`
  ALTER TABLE events ADD COLUMN IF NOT EXISTS vote_rate_limit INTEGER NOT NULL DEFAULT 10 CHECK (vote_rate_limit > 0)
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (submission_id, voter_id)
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    object TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

console.log("migrate: schema up to date");
await pool.end();
