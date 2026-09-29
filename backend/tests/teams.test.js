// Integration tests for the organizer/admin team-listing endpoint.
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

test("organizer/admin can list all teams with members and submission status", async () => {
  const organizerToken = await login("organizer@dogfood.dev");
  const { status, data } = await api("GET", "/api/teams", undefined, organizerToken);
  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1, "the seeded team should show up");
  const seeded = data[0];
  assert.ok(Array.isArray(seeded.members));
  assert.ok("submission" in seeded);
});

test("a participant cannot list all teams", async () => {
  const participantToken = await login("participant@dogfood.dev");
  const { status } = await api("GET", "/api/teams", undefined, participantToken);
  assert.equal(status, 403);
});

test("GET /api/teams can be filtered by event_id", async () => {
  const organizerToken = await login("organizer@dogfood.dev");
  const { data: all } = await api("GET", "/api/teams", undefined, organizerToken);
  const eventId = all[0].event_id;
  const { status, data } = await api("GET", `/api/teams?event_id=${eventId}`, undefined, organizerToken);
  assert.equal(status, 200);
  assert.ok(data.every((t) => t.event_id === eventId));
});
