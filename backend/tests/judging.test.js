// Integration tests for T2 (judging) against a *running* backend — same
// pattern as api.test.js. Relies on the seed data: 1 event, 1 submitted
// project, a 4-criterion rubric (weights sum to 100), and the seed judge
// already assigned to the seed submission.
//
// Run with: npm test   (from backend/, while docker compose is up)

import { test } from "node:test";
import assert from "node:assert/strict";

const base = process.env.API_URL ?? "http://localhost:8000";

async function api(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const isCsv = res.headers.get("content-type")?.includes("text/csv");
  const data = isCsv ? await res.text() : await res.json().catch(() => null);
  return { status: res.status, data };
}

async function login(email, password = "password123") {
  const { data } = await api("POST", "/api/auth/login", { email, password });
  return data.token;
}

async function seedEventId(orgToken) {
  const { data: events } = await api("GET", "/api/events", undefined, orgToken);
  return events.find((e) => e.name === "Dogfood Hackathon 2026").id;
}

test("rubric: seeded event has 4 criteria summing to weight 100", async () => {
  const orgToken = await login("organizer@dogfood.dev");
  const eventId = await seedEventId(orgToken);
  const { status, data } = await api("GET", `/api/judging/rubric?event_id=${eventId}`, undefined, orgToken);
  assert.equal(status, 200);
  assert.equal(data.length, 4);
  const total = data.reduce((s, c) => s + Number(c.weight), 0);
  assert.equal(total, 100);
});

test("rubric: weights not summing to 100 are rejected", async () => {
  const orgToken = await login("organizer@dogfood.dev");
  const eventId = await seedEventId(orgToken);
  const { status, data } = await api(
    "POST",
    "/api/judging/rubric",
    { event_id: eventId, criteria: [{ name: "Only one", weight: 60 }] },
    orgToken
  );
  assert.equal(status, 400);
  assert.match(data.error, /sum to 100/);
});

test("wrong role gets 403: participant cannot assign judges", async () => {
  const partToken = await login("participant@dogfood.dev");
  const orgToken = await login("organizer@dogfood.dev");
  const eventId = await seedEventId(orgToken);
  const { status } = await api("POST", "/api/judging/assign", { event_id: eventId }, partToken);
  assert.equal(status, 403);
});

test("wrong role gets 403: participant cannot see another judge's queue", async () => {
  const partToken = await login("participant@dogfood.dev");
  const { status } = await api("GET", "/api/judging/my-assignments", undefined, partToken);
  assert.equal(status, 403);
});

test("judge sees the seeded assignment in their queue", async () => {
  const judgeToken = await login("judge@dogfood.dev");
  const { status, data } = await api("GET", "/api/judging/my-assignments", undefined, judgeToken);
  assert.equal(status, 200);
  assert.ok(data.length >= 1, "expected at least the seeded assignment");
});

// Sets up a second, independent judge + submission + assignment directly
// against the database (public signup can only create participants, and
// the seed data only has one judge), so this test can prove *ownership*
// isolation specifically -- a real judge, correctly authenticated, still
// can't touch an assignment that isn't theirs. This is different from (and
// a stronger check than) the earlier role-based 403 tests.
test("role isolation: a judge cannot score another judge's assignment", async () => {
  const pgModule = await import("pg");
  const bcryptModule = await import("bcryptjs");
  // Falls back to the port docker-compose publishes to the host (55432,
  // deliberately not Postgres's default 5432 — see docker-compose.yml) —
  // DATABASE_URL itself is only set inside the backend container, where it
  // points at the `db` service by its Docker network name, not localhost.
  const dbUrl = process.env.DATABASE_URL ?? "postgres://dogfood:dogfood@localhost:55432/dogfood";
  const pool = new pgModule.default.Pool({ connectionString: dbUrl });

  const orgToken = await login("organizer@dogfood.dev");
  const eventId = await seedEventId(orgToken);
  const judgeAToken = await login("judge@dogfood.dev");

  try {
    const stamp = Date.now();
    const hash = await bcryptModule.default.hash("password123", 10);
    const { rows: judgeBRows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'judge') RETURNING id`,
      [`Judge B ${stamp}`, `judge-b-${stamp}@dogfood.dev`, hash]
    );
    const judgeBId = judgeBRows[0].id;

    const { rows: teamRows } = await pool.query(
      `INSERT INTO teams (event_id, name, invite_code, created_by)
       VALUES ($1, $2, $3, (SELECT id FROM users WHERE email = 'participant@dogfood.dev')) RETURNING id`,
      [eventId, `Isolation Test Team ${stamp}`, `ISO${stamp}`.slice(0, 12)]
    );
    const { rows: subRows } = await pool.query(
      `INSERT INTO submissions (team_id, title, is_draft, submitted_at) VALUES ($1, $2, false, now()) RETURNING id`,
      [teamRows[0].id, `Isolation Test Project ${stamp}`]
    );
    const { rows: assignmentRows } = await pool.query(
      `INSERT INTO judge_assignments (event_id, judge_id, submission_id) VALUES ($1, $2, $3) RETURNING id`,
      [eventId, judgeBId, subRows[0].id]
    );
    const judgeBAssignmentId = assignmentRows[0].id;

    // Judge A (a real, currently-assigned judge) tries to score Judge B's
    // assignment. Must be rejected even though Judge A's role is correct.
    const { status } = await api(
      "POST",
      `/api/judging/assignments/${judgeBAssignmentId}/scores`,
      { scores: [{ criterion_id: 1, raw_score: 5 }] },
      judgeAToken
    );
    assert.equal(status, 403);
  } finally {
    await pool.end();
  }
});

test("judge can score their assignment, then complete it", async () => {
  const orgToken = await login("organizer@dogfood.dev");
  const eventId = await seedEventId(orgToken);
  const judgeToken = await login("judge@dogfood.dev");

  const { data: rubric } = await api("GET", `/api/judging/rubric?event_id=${eventId}`, undefined, judgeToken);
  const { data: myAssignments } = await api("GET", "/api/judging/my-assignments", undefined, judgeToken);
  // Re-running the suite against the same persistent dev database means
  // the seeded assignment may already be `completed` from a prior run
  // (assignments lock once completed — see JUDGING.md). Fall back to
  // making a fresh one for this judge, rather than assuming index 0 is
  // still scoreable.
  let pending = myAssignments.find((a) => a.status === "pending");
  if (!pending) {
    const pgModule = await import("pg");
    const dbUrl = process.env.DATABASE_URL ?? "postgres://dogfood:dogfood@localhost:55432/dogfood";
    const pool = new pgModule.default.Pool({ connectionString: dbUrl });
    try {
      const stamp = Date.now();
      const { rows: teamRows } = await pool.query(
        `INSERT INTO teams (event_id, name, invite_code, created_by)
         VALUES ($1, $2, $3, (SELECT id FROM users WHERE email = 'participant@dogfood.dev')) RETURNING id`,
        [eventId, `Rescore Test Team ${stamp}`, `RSC${stamp}`.slice(0, 12)]
      );
      const { rows: subRows } = await pool.query(
        `INSERT INTO submissions (team_id, title, is_draft, submitted_at) VALUES ($1, $2, false, now()) RETURNING id`,
        [teamRows[0].id, `Rescore Test Project ${stamp}`]
      );
      const { rows: judgeRows } = await pool.query(
        "SELECT id FROM users WHERE email = 'judge@dogfood.dev'"
      );
      const { rows: assignmentRows } = await pool.query(
        `INSERT INTO judge_assignments (event_id, judge_id, submission_id) VALUES ($1, $2, $3) RETURNING id, status`,
        [eventId, judgeRows[0].id, subRows[0].id]
      );
      pending = assignmentRows[0];
    } finally {
      await pool.end();
    }
  }
  const assignmentId = pending.id;

  const scores = rubric.map((c) => ({ criterion_id: c.id, raw_score: 8 }));
  const { status: saveStatus } = await api(
    "POST", `/api/judging/assignments/${assignmentId}/scores`, { scores }, judgeToken
  );
  assert.equal(saveStatus, 200);

  const { status: completeStatus, data: completed } = await api(
    "POST", `/api/judging/assignments/${assignmentId}/complete`, undefined, judgeToken
  );
  assert.equal(completeStatus, 200);
  assert.equal(completed.status, "completed");
});

test("results: normalized results are computed for the event after scoring", async () => {
  const orgToken = await login("organizer@dogfood.dev");
  const eventId = await seedEventId(orgToken);
  const { status, data } = await api("GET", `/api/judging/results?event_id=${eventId}`, undefined, orgToken);
  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1);
  assert.ok("normalized_avg" in data[0]);
});

test("CSV export: results export returns CSV content", async () => {
  const orgToken = await login("organizer@dogfood.dev");
  const eventId = await seedEventId(orgToken);
  const { status, data } = await api("GET", `/api/judging/export.csv?event_id=${eventId}&type=results`, undefined, orgToken);
  assert.equal(status, 200);
  assert.match(data, /submission_id,title,team_name/);
});

test("assign: refuses to assign judges to an event with no rubric configured", async () => {
  const orgToken = await login("organizer@dogfood.dev");
  const { data: created } = await api(
    "POST",
    "/api/events",
    { name: `Rubric-less Event ${Date.now()}`, submission_deadline: "2099-01-01T00:00:00Z" },
    orgToken
  );
  const { status, data } = await api("POST", "/api/judging/assign", { event_id: created.id }, orgToken);
  assert.equal(status, 400);
  assert.match(data.error, /no rubric criteria/);
});
