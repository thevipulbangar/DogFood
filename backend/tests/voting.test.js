// Integration tests against a *running* backend (docker compose up must be
// running first). Uses the API to set up its own fixtures rather than
// relying on seed data alone, since voting needs two distinct teams.

import { test } from "node:test";
import assert from "node:assert/strict";

const base = process.env.API_URL ?? "http://localhost:8000";

async function api(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function login(email, password = "password123") {
  const { data } = await api("POST", "/api/auth/login", { email, password });
  return data.token;
}

async function makeSubmittedTeam(eventId, suffix) {
  const email = `voter-${suffix}-${Date.now()}@dogfood.dev`;
  await api("POST", "/api/auth/signup", { name: `Voter ${suffix}`, email, password: "password123" });
  const token = await login(email);
  const { data: team } = await api("POST", "/api/teams", { event_id: eventId, name: `Voting Team ${suffix} ${Date.now()}` }, token);
  const { data: sub } = await api("POST", "/api/submissions", { team_id: team.id, title: `Entry ${suffix}`, description: "x".repeat(40) }, token);
  await api("POST", `/api/submissions/${sub.id}/submit`, undefined, token);
  return { token, teamId: team.id, submissionId: sub.id };
}

test("voting: participant can vote once, a second vote on the same project is rejected as duplicate", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { data: events } = await api("GET", "/api/events", undefined, adminToken);
  const eventId = events[0].id;

  const a = await makeSubmittedTeam(eventId, "a");
  const b = await makeSubmittedTeam(eventId, "b");

  const first = await api("POST", `/api/voting/${b.submissionId}/vote`, undefined, a.token);
  assert.equal(first.status, 201);

  const second = await api("POST", `/api/voting/${b.submissionId}/vote`, undefined, a.token);
  assert.equal(second.status, 409);
});

test("voting: cannot vote for your own team's submission", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { data: events } = await api("GET", "/api/events", undefined, adminToken);
  const eventId = events[0].id;

  const a = await makeSubmittedTeam(eventId, "self");
  const { status } = await api("POST", `/api/voting/${a.submissionId}/vote`, undefined, a.token);
  assert.equal(status, 400);
});

test("voting: judges and organizers cannot cast votes (role isolation)", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { data: events } = await api("GET", "/api/events", undefined, adminToken);
  const eventId = events[0].id;
  const a = await makeSubmittedTeam(eventId, "target");

  const judgeToken = await login("judge@dogfood.dev");
  const { status } = await api("POST", `/api/voting/${a.submissionId}/vote`, undefined, judgeToken);
  assert.equal(status, 403);
});

test("voting results: hidden from participants until an organizer publishes them", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { data: events } = await api("GET", "/api/events", undefined, adminToken);
  const eventId = events[0].id;

  // Ensure a known, unpublished state.
  await api("POST", "/api/voting/publish", { event_id: eventId, published: false }, adminToken);

  const participantToken = await login("participant@dogfood.dev");
  const hidden = await api("GET", `/api/voting/results?event_id=${eventId}`, undefined, participantToken);
  assert.equal(hidden.status, 403);

  const staffPreview = await api("GET", `/api/voting/results?event_id=${eventId}`, undefined, adminToken);
  assert.equal(staffPreview.status, 200);

  const publish = await api("POST", "/api/voting/publish", { event_id: eventId, published: true }, adminToken);
  assert.equal(publish.status, 200);

  const visible = await api("GET", `/api/voting/results?event_id=${eventId}`, undefined, participantToken);
  assert.equal(visible.status, 200);
  assert.equal(visible.data.published, true);
});

test("comments: any authenticated role can post and read", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { data: events } = await api("GET", "/api/events", undefined, adminToken);
  const eventId = events[0].id;
  const a = await makeSubmittedTeam(eventId, "commentable");

  const post = await api("POST", `/api/voting/${a.submissionId}/comments`, { body: "Great use of Postgres." }, a.token);
  assert.equal(post.status, 201);

  const list = await api("GET", `/api/voting/${a.submissionId}/comments`, undefined, adminToken);
  assert.equal(list.status, 200);
  assert.ok(list.data.some((c) => c.body === "Great use of Postgres."));
});

test("audit log: organizer/admin only, records a vote and a rejected duplicate", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const participantForbidden = await api("GET", "/api/audit", undefined, await login("participant@dogfood.dev"));
  assert.equal(participantForbidden.status, 403);

  const { data: events } = await api("GET", "/api/events", undefined, adminToken);
  const eventId = events[0].id;
  const a = await makeSubmittedTeam(eventId, "audit-a");
  const b = await makeSubmittedTeam(eventId, "audit-b");
  await api("POST", `/api/voting/${b.submissionId}/vote`, undefined, a.token);
  await api("POST", `/api/voting/${b.submissionId}/vote`, undefined, a.token); // duplicate, rejected

  const { status, data } = await api("GET", "/api/audit?limit=20", undefined, adminToken);
  assert.equal(status, 200);
  assert.ok(data.some((e) => e.action === "VOTE_CAST"));
  assert.ok(data.some((e) => e.action === "VOTE_REJECTED_DUPLICATE"));
});
