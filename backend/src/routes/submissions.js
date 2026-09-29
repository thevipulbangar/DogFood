import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";

export const submissionsRouter = Router();

// Looks up the caller's team + its event deadline in one go, so every
// handler below can check "is this my team?" and "is it too late?" the
// same way.
async function getMyTeam(userId, teamId) {
  const { rows } = await pool.query(
    `SELECT teams.*, events.submission_deadline
     FROM teams
     JOIN team_members ON team_members.team_id = teams.id
     JOIN events ON events.id = teams.event_id
     WHERE teams.id = $1 AND team_members.user_id = $2`,
    [teamId, userId]
  );
  return rows[0];
}

function isPastDeadline(team) {
  return new Date() > new Date(team.submission_deadline);
}

// Create the (draft) submission for your team. One submission per team.
submissionsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { team_id, title, description, track, repo_url, demo_url } = req.body ?? {};
    if (!team_id) return res.status(400).json({ error: "team_id is required" });

    const team = await getMyTeam(req.user.id, team_id);
    if (!team) return res.status(403).json({ error: "you are not a member of this team" });
    if (isPastDeadline(team)) {
      return res.status(403).json({ error: "submission deadline has passed" });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO submissions (team_id, title, description, track, repo_url, demo_url)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [team_id, title ?? null, description ?? null, track ?? null, repo_url ?? null, demo_url ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "this team already has a submission" });
      }
      throw err;
    }
  })
);

// Edit your team's draft. Rejected once the event's deadline has passed,
// or once the submission is already finalized.
submissionsRouter.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows: subRows } = await pool.query(
      "SELECT * FROM submissions WHERE id = $1",
      [req.params.id]
    );
    const submission = subRows[0];
    if (!submission) return res.status(404).json({ error: "submission not found" });

    const team = await getMyTeam(req.user.id, submission.team_id);
    if (!team) return res.status(403).json({ error: "you are not a member of this team" });
    if (isPastDeadline(team)) {
      return res.status(403).json({ error: "submission deadline has passed" });
    }
    if (!submission.is_draft) {
      return res.status(403).json({ error: "submission is already finalized" });
    }

    const { title, description, track, repo_url, demo_url } = req.body ?? {};
    const { rows } = await pool.query(
      `UPDATE submissions SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         track = COALESCE($3, track),
         repo_url = COALESCE($4, repo_url),
         demo_url = COALESCE($5, demo_url),
         updated_at = now()
       WHERE id = $6 RETURNING *`,
      [title, description, track, repo_url, demo_url, submission.id]
    );
    res.json(rows[0]);
  })
);

// Lock the submission in. Rejected once the deadline has passed.
submissionsRouter.post(
  "/:id/submit",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows: subRows } = await pool.query(
      "SELECT * FROM submissions WHERE id = $1",
      [req.params.id]
    );
    const submission = subRows[0];
    if (!submission) return res.status(404).json({ error: "submission not found" });

    const team = await getMyTeam(req.user.id, submission.team_id);
    if (!team) return res.status(403).json({ error: "you are not a member of this team" });
    if (isPastDeadline(team)) {
      return res.status(403).json({ error: "submission deadline has passed" });
    }

    const { rows } = await pool.query(
      `UPDATE submissions SET is_draft = false, submitted_at = now() WHERE id = $1 RETURNING *`,
      [submission.id]
    );
    res.json(rows[0]);
  })
);
