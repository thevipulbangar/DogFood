import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";

export const galleryRouter = Router();

// No login required. Only shows finalized (non-draft) submissions.
galleryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, track } = req.query;
    const conditions = ["submissions.is_draft = false"];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(submissions.title ILIKE $${params.length} OR submissions.description ILIKE $${params.length})`);
    }
    if (track) {
      params.push(track);
      conditions.push(`submissions.track = $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT submissions.id, submissions.title, submissions.description, submissions.track,
              submissions.repo_url, submissions.demo_url, submissions.submitted_at,
              teams.name AS team_name
       FROM submissions
       JOIN teams ON teams.id = submissions.team_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY submissions.submitted_at DESC`,
      params
    );
    res.json(rows);
  })
);

// Single submission detail for the public gallery. Same visibility rule:
// only finalized (non-draft) submissions are exposed.
galleryRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT submissions.id, submissions.title, submissions.description, submissions.track,
              submissions.repo_url, submissions.demo_url, submissions.submitted_at,
              teams.name AS team_name, teams.event_id,
              events.name AS event_name
       FROM submissions
       JOIN teams ON teams.id = submissions.team_id
       JOIN events ON events.id = teams.event_id
       WHERE submissions.id = $1 AND submissions.is_draft = false`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "not found" });

    const { rows: memberRows } = await pool.query(
      `SELECT users.id, users.name
       FROM team_members
       JOIN users ON users.id = team_members.user_id
       WHERE team_members.team_id = (SELECT team_id FROM submissions WHERE id = $1)`,
      [req.params.id]
    );

    res.json({ ...rows[0], members: memberRows });
  })
);
