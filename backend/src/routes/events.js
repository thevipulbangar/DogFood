import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";
import { logAudit } from "../audit.js";

export const eventsRouter = Router();

// Any logged-in user can see the list of events.
eventsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query("SELECT * FROM events ORDER BY id");
    res.json(rows);
  })
);

// Only organizers/admins can create or edit events.
eventsRouter.post(
  "/",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const {
      name, description, start_date, end_date, submission_deadline, tracks, prizes,
      voting_open = true, vote_rate_limit = 10,
    } = req.body ?? {};
    if (!name || !submission_deadline) {
      return res.status(400).json({ error: "name and submission_deadline are required" });
    }
    if (typeof vote_rate_limit !== "number" || vote_rate_limit <= 0) {
      return res.status(400).json({ error: "vote_rate_limit must be a positive number" });
    }
    const { rows } = await pool.query(
      `INSERT INTO events (name, description, start_date, end_date, submission_deadline, tracks, prizes, voting_open, vote_rate_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, description ?? null, start_date ?? null, end_date ?? null, submission_deadline, tracks ?? [], prizes ?? null, voting_open, vote_rate_limit]
    );
    res.status(201).json(rows[0]);
  })
);

eventsRouter.put(
  "/:id",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const {
      name, description, start_date, end_date, submission_deadline, tracks, prizes,
      voting_open, vote_rate_limit,
    } = req.body ?? {};
    if (vote_rate_limit !== undefined && (typeof vote_rate_limit !== "number" || vote_rate_limit <= 0)) {
      return res.status(400).json({ error: "vote_rate_limit must be a positive number" });
    }
    const { rows } = await pool.query(
      `UPDATE events SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         start_date = COALESCE($3, start_date),
         end_date = COALESCE($4, end_date),
         submission_deadline = COALESCE($5, submission_deadline),
         tracks = COALESCE($6, tracks),
         prizes = COALESCE($7, prizes),
         voting_open = COALESCE($8, voting_open),
         vote_rate_limit = COALESCE($9, vote_rate_limit)
       WHERE id = $10 RETURNING *`,
      [name, description, start_date, end_date, submission_deadline, tracks, prizes, voting_open ?? null, vote_rate_limit ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "event not found" });
    if (voting_open !== undefined) {
      await logAudit(req.user.id, voting_open ? "VOTING_OPENED" : "VOTING_CLOSED", `event:${req.params.id}`);
    }
    res.json(rows[0]);
  })
);
