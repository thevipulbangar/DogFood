// Wipes every row from every table, then re-runs the seed script.
//
// Why this exists: the integration test suite (backend/tests/*.test.js)
// runs real HTTP requests against a *live* backend, which means every
// `npm test` run creates real teams, submissions, events and users in
// whatever database the backend is currently pointed at. The default
// `docker compose` setup uses one Postgres instance for everything —
// there's no separate throwaway test database — so the public gallery
// and admin panels can end up full of test debris: extra teams, draft
// submissions with placeholder titles, one-off events created mid-test.
//
// Run this to clear all of that out and get back to exactly the fixture
// data described in the README:
//   docker compose exec backend npm run reset

import pg from "pg";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const TABLES = [
  "scores",
  "judge_assignments",
  "rubric_criteria",
  "submissions",
  "team_members",
  "teams",
  "events",
  "password_reset_tokens",
  "users",
];

async function reset() {
  console.log("reset: truncating all tables...");
  await pool.query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  console.log("reset: database is now empty");
}

try {
  await reset();
} catch (err) {
  console.error("reset failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}

// Re-seed in a fresh process so it gets its own clean pool/connection
// rather than reusing one we just tore down above.
const result = spawnSync(process.execPath, [path.join(__dirname, "seed.js")], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 0);
