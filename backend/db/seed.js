// Runs on every container start (see backend/Dockerfile's CMD), before the
// server starts listening. Safe to run any number of times: each piece
// below checks whether its own row(s) already exist before inserting, so
// restarting the stack — or adding a new seeding step in a later version —
// never creates duplicates and never gets silently skipped.

import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function waitForDb(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch {
      console.log(`seed: waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("seed: database never became reachable");
}

// Each step below checks its own existence and backfills if missing,
// rather than one all-or-nothing "already seeded" guard. That matters
// because this file gets extended over time (T2 added rubric criteria and
// a judge assignment after users/event/team/submission already existed on
// any instance that had been running since T1) — a single early-return
// would silently skip every step added after the first deploy, forever,
// on an instance that was seeded before that step existed.
async function seed() {
  await waitForDb();

  const users = await ensureUsers();
  const eventId = await ensureEvent();
  const teamId = await ensureTeam(eventId, users.participant);
  const submissionId = await ensureSubmission(teamId);
  await ensureRubric(eventId);
  await ensureJudgeAssignment(eventId, users.judge, submissionId);

  console.log("seed: schema data up to date");
}

async function ensureUsers() {
  const roles = ["participant", "judge", "organizer", "admin"];
  const { rows: existingRows } = await pool.query(
    "SELECT role, id FROM users WHERE email = ANY($1)",
    [roles.map((r) => `${r}@dogfood.dev`)]
  );
  const users = Object.fromEntries(existingRows.map((r) => [r.role, r.id]));
  if (Object.keys(users).length === roles.length) return users;

  const passwordHash = await bcrypt.hash("password123", 10);
  for (const role of roles) {
    if (users[role]) continue;
    const name = role === "admin" ? "Admin" : `Seed ${role}`;
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, `${role}@dogfood.dev`, passwordHash, role]
    );
    users[role] = rows[0].id;
  }
  return users;
}

async function ensureEvent() {
  const { rows } = await pool.query("SELECT id FROM events WHERE name = $1", [
    "Dogfood Hackathon 2026",
  ]);
  if (rows[0]) return rows[0].id;

  const submissionDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week out
  const { rows: eventRows } = await pool.query(
    `INSERT INTO events (name, description, start_date, end_date, submission_deadline, tracks, prizes)
     VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '2 days', $3, $4, $5)
     RETURNING id`,
    [
      "Dogfood Hackathon 2026",
      "Seed event created automatically on first start.",
      submissionDeadline,
      ["AI/ML", "Web", "Hardware"],
      "$500 for first place",
    ]
  );
  return eventRows[0].id;
}

async function ensureTeam(eventId, participantId) {
  const { rows } = await pool.query("SELECT id FROM teams WHERE invite_code = $1", ["SEED123"]);
  if (rows[0]) return rows[0].id;

  const { rows: teamRows } = await pool.query(
    `INSERT INTO teams (event_id, name, invite_code, created_by)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [eventId, "Seed Team", "SEED123", participantId]
  );
  const teamId = teamRows[0].id;
  await pool.query(
    `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [teamId, participantId]
  );
  return teamId;
}

async function ensureSubmission(teamId) {
  const { rows } = await pool.query("SELECT id FROM submissions WHERE team_id = $1", [teamId]);
  if (rows[0]) return rows[0].id;

  const { rows: subRows } = await pool.query(
    `INSERT INTO submissions (team_id, title, description, track, repo_url, demo_url, is_draft, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, now()) RETURNING id`,
    [
      teamId,
      "Seed Project",
      "A sample submitted project created by the seed script.",
      "Web",
      "https://github.com/example/seed-project",
      "https://example.com/demo",
    ]
  );
  return subRows[0].id;
}

// A starter rubric (weights sum to 100), so the judging UI has something
// real to show immediately instead of starting completely empty.
async function ensureRubric(eventId) {
  const { rows } = await pool.query(
    "SELECT id FROM rubric_criteria WHERE event_id = $1",
    [eventId]
  );
  if (rows.length > 0) return;

  const criteria = [
    ["Innovation", "Does it rethink the problem or reproduce what exists?", 25],
    ["Technical Execution", "Correctness, robustness and code quality.", 30],
    ["Impact", "Would organizers actually adopt this?", 20],
    ["Design", "Clarity of UX for every role.", 25],
  ];
  for (const [name, description, weight] of criteria) {
    await pool.query(
      `INSERT INTO rubric_criteria (event_id, name, description, weight) VALUES ($1, $2, $3, $4)`,
      [eventId, name, description, weight]
    );
  }
}

async function ensureJudgeAssignment(eventId, judgeId, submissionId) {
  await pool.query(
    `INSERT INTO judge_assignments (event_id, judge_id, submission_id)
     VALUES ($1, $2, $3) ON CONFLICT (judge_id, submission_id) DO NOTHING`,
    [eventId, judgeId, submissionId]
  );
}

try {
  await seed();
} catch (err) {
  console.error("seed failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
