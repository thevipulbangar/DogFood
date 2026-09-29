// Integration tests against a *running* backend (docker compose up must be
// running first — these hit real HTTP endpoints, not mocked code). They
// rely on the seed data created by db/seed.js.
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
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function login(email, password = "password123") {
  const { data } = await api("POST", "/api/auth/login", { email, password });
  return data.token;
}

test("seed data loads: 4 seeded roles can log in", async () => {
  for (const role of ["participant", "judge", "organizer", "admin"]) {
    const { status, data } = await api("POST", "/api/auth/login", {
      email: `${role}@dogfood.dev`,
      password: "password123",
    });
    assert.equal(status, 200, `${role} login should succeed`);
    assert.equal(data.user.role, role);
  }
});

test("seed data loads: gallery shows the seeded submitted project", async () => {
  const { status, data } = await api("GET", "/api/gallery");
  assert.equal(status, 200);
  assert.ok(
    data.some((p) => p.title === "Seed Project"),
    "expected seeded 'Seed Project' in public gallery"
  );
});

test("public stats: returns aggregate counts with no auth required", async () => {
  const { status, data } = await api("GET", "/api/stats");
  assert.equal(status, 200);
  assert.ok(typeof data.events === "number" && data.events >= 1);
  assert.ok(typeof data.teams === "number" && data.teams >= 1);
  assert.ok(typeof data.submissions === "number" && data.submissions >= 1);
});

test("gallery detail: seeded submitted project is fetchable by id, drafts 404", async () => {
  const { data: list } = await api("GET", "/api/gallery");
  const seed = list.find((p) => p.title === "Seed Project");
  assert.ok(seed, "expected seeded 'Seed Project' in public gallery");

  const { status, data } = await api("GET", `/api/gallery/${seed.id}`);
  assert.equal(status, 200);
  assert.equal(data.title, "Seed Project");
  assert.ok(Array.isArray(data.members));

  const { status: missingStatus } = await api("GET", "/api/gallery/999999");
  assert.equal(missingStatus, 404);
});

test("wrong role gets 403: participant cannot create an event", async () => {
  const token = await login("participant@dogfood.dev");
  const { status } = await api(
    "POST",
    "/api/events",
    { name: "Not allowed", submission_deadline: new Date().toISOString() },
    token
  );
  assert.equal(status, 403);
});

test("organizer can create an event (control case for the 403 test above)", async () => {
  const token = await login("organizer@dogfood.dev");
  const { status } = await api(
    "POST",
    "/api/events",
    { name: "Allowed", submission_deadline: new Date(Date.now() + 3600_000).toISOString() },
    token
  );
  assert.equal(status, 201);
});

test("a late submission is rejected", async () => {
  const orgToken = await login("organizer@dogfood.dev");
  const partToken = await login("participant@dogfood.dev");

  const { data: event } = await api(
    "POST",
    "/api/events",
    { name: "Closed Event", submission_deadline: new Date(Date.now() - 3600_000).toISOString() },
    orgToken
  );

  const { data: team } = await api(
    "POST",
    "/api/teams",
    { event_id: event.id, name: "Doomed Team" },
    partToken
  );

  const { status, data } = await api(
    "POST",
    "/api/submissions",
    { team_id: team.id, title: "Too late" },
    partToken
  );
  assert.equal(status, 403);
  assert.match(data.error, /deadline/);
});

test("signup ignores a client-supplied role: always creates a participant", async () => {
  const email = `role-test-${Date.now()}@example.com`;
  const { status, data } = await api("POST", "/api/auth/signup", {
    name: "Role Test",
    email,
    password: "password123",
    role: "admin",
  });
  assert.equal(status, 201);
  assert.equal(data.user.role, "participant");
});

test("forgot-password responds identically for a real and a fake email (no user enumeration)", async () => {
  const real = await api("POST", "/api/auth/forgot-password", { email: "participant@dogfood.dev" });
  const fake = await api("POST", "/api/auth/forgot-password", { email: "nobody@nowhere.dev" });
  assert.equal(real.status, 200);
  assert.equal(fake.status, 200);
  assert.deepEqual(real.data, fake.data);
});

test("reset-password rejects an invalid token", async () => {
  const { status, data } = await api("POST", "/api/auth/reset-password", {
    token: "not-a-real-token",
    password: "newpassword123",
  });
  assert.equal(status, 400);
  assert.match(data.error, /invalid|expired/);
});
