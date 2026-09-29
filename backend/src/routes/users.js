import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";

export const usersRouter = Router();

// Every route here is admin-only. There is exactly one admin account in
// this platform (seeded once, see db/seed.js and the `one_admin_only`
// index in schema.sql) — nothing here can create or promote anyone to
// admin. Judge and organizer accounts, on the other hand, are never
// self-registered: `POST /api/auth/signup` always creates a participant,
// so this is the only way a judge or organizer account comes to exist.
const CREATABLE_ROLES = ["organizer", "judge"];

usersRouter.get(
  "/",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { role } = req.query;
    const { rows } = role
      ? await pool.query(
          "SELECT id, name, email, role, created_at FROM users WHERE role = $1 ORDER BY id",
          [role]
        )
      : await pool.query(
          "SELECT id, name, email, role, created_at FROM users ORDER BY id"
        );
    res.json(rows);
  })
);

// Creates a brand-new organizer or judge account. (Promoting an existing
// participant in place, rather than creating a second account for the
// same person, is a reasonable follow-up but out of scope here — this
// covers the spec's "judge invitation" requirement directly.)
usersRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body ?? {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "name, email, password and role are required" });
    }
    if (!CREATABLE_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role must be one of: ${CREATABLE_ROLES.join(", ")}`,
      });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at`,
        [name, email, passwordHash, role]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "email already in use" });
      }
      throw err;
    }
  })
);

// Deletes any account (participant, judge, or organizer). Two things it
// deliberately refuses even for the admin: deleting yourself (there's
// exactly one admin — that would lock the instance out of account
// management with no way back in short of touching the database
// directly) and deleting the last admin by id for the same reason. A
// user's team memberships, judge assignments and scores cascade away with
// them (see schema.sql); a user who *created* a team does not cascade
// (teams.created_by has no ON DELETE), so that case is reported as 409
// rather than a raw foreign-key 500.
usersRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: "you cannot delete your own account" });
    }

    try {
      const { rows } = await pool.query(
        "DELETE FROM users WHERE id = $1 AND role != 'admin' RETURNING id",
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "user not found, or is the admin account" });
      }
      res.status(204).end();
    } catch (err) {
      if (err.code === "23503") {
        return res.status(409).json({
          error: "cannot delete: this user created a team. Reassign or delete that team first.",
        });
      }
      throw err;
    }
  })
);
