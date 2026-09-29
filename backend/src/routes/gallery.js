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
