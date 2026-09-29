// Integration tests against a *running* backend (docker compose up must be
// running first) for account creation: only the admin can create judge/
// organizer accounts, and there can only ever be one admin.
//
// Run with: npm test   (from backend/, while docker compose is up)

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

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

test("admin can create a judge account, and that account can log in", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const email = `judge-${crypto.randomBytes(4).toString("hex")}@dogfood.dev`;

  const { status, data } = await api(
    "POST",
    "/api/users",
    { name: "New Judge", email, password: "password123", role: "judge" },
    adminToken
  );
  assert.equal(status, 201);
  assert.equal(data.role, "judge");
  assert.equal(data.email, email);
  assert.equal(data.password_hash, undefined, "password hash must never be returned");

  const loginToken = await login(email);
  assert.ok(loginToken, "the newly created judge should be able to log in");
});

test("admin can create an organizer account", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const email = `organizer-${crypto.randomBytes(4).toString("hex")}@dogfood.dev`;

  const { status, data } = await api(
    "POST",
    "/api/users",
    { name: "New Organizer", email, password: "password123", role: "organizer" },
    adminToken
  );
  assert.equal(status, 201);
  assert.equal(data.role, "organizer");
});

test("a non-admin (organizer) cannot create accounts", async () => {
  const organizerToken = await login("organizer@dogfood.dev");
  const { status } = await api(
    "POST",
    "/api/users",
    { name: "Nope", email: "nope@dogfood.dev", password: "password123", role: "judge" },
    organizerToken
  );
  assert.equal(status, 403);
});

test("even the admin cannot create another admin account", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { status, data } = await api(
    "POST",
    "/api/users",
    { name: "Second Admin", email: `admin2-${crypto.randomBytes(4).toString("hex")}@dogfood.dev`, password: "password123", role: "admin" },
    adminToken
  );
  assert.equal(status, 400);
  assert.match(data.error, /role must be one of/);
});

test("creating an account with an email already in use is rejected", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { status, data } = await api(
    "POST",
    "/api/users",
    { name: "Duplicate", email: "judge@dogfood.dev", password: "password123", role: "judge" },
    adminToken
  );
  assert.equal(status, 409);
  assert.match(data.error, /already in use/);
});

test("admin can list users, optionally filtered by role", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { status, data } = await api("GET", "/api/users?role=judge", undefined, adminToken);
  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.every((u) => u.role === "judge"));
  assert.ok(data.some((u) => u.email === "judge@dogfood.dev"));
});

test("a non-admin cannot list users", async () => {
  const judgeToken = await login("judge@dogfood.dev");
  const { status } = await api("GET", "/api/users", undefined, judgeToken);
  assert.equal(status, 403);
});

test("admin can delete a non-admin account, which can then no longer log in", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const email = `delete-me-${crypto.randomBytes(4).toString("hex")}@dogfood.dev`;
  const { data: created } = await api(
    "POST", "/api/users", { name: "Delete Me", email, password: "password123", role: "judge" }, adminToken
  );

  const { status } = await api("DELETE", `/api/users/${created.id}`, undefined, adminToken);
  assert.equal(status, 204);

  const { status: loginStatus } = await api("POST", "/api/auth/login", { email, password: "password123" });
  assert.equal(loginStatus, 401);
});

test("admin cannot delete their own account", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { data: me } = await api("POST", "/api/auth/login", { email: "admin@dogfood.dev", password: "password123" });
  const { status, data } = await api("DELETE", `/api/users/${me.user.id}`, undefined, adminToken);
  assert.equal(status, 400);
  assert.match(data.error, /own account/);
});

test("deleting the admin account by id is refused even if attempted directly", async () => {
  const adminToken = await login("admin@dogfood.dev");
  const { data: users } = await api("GET", "/api/users?role=admin", undefined, adminToken);
  const { status } = await api("DELETE", `/api/users/${users[0].id}`, undefined, adminToken);
  // Same account as the caller here, so this also exercises the self-delete guard,
  // but the role check backs it up independently (see users.js).
  assert.equal(status, 400);
});

test("a non-admin cannot delete accounts", async () => {
  const organizerToken = await login("organizer@dogfood.dev");
  const { data: participant } = await api(
    "POST", "/api/auth/login", { email: "participant@dogfood.dev", password: "password123" }
  );
  const { status } = await api("DELETE", `/api/users/${participant.user.id}`, undefined, organizerToken);
  assert.equal(status, 403);
});
