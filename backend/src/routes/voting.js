import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";
import { logAudit } from "../audit.js";

export const votingRouter = Router();

const RATE_LIMIT_WINDOW = "1 minute";

async function getEventVotingConfig(eventId) {
  const { rows } = await pool.query(
    "SELECT voting_open, vote_rate_limit FROM events WHERE id = $1",
    [eventId]
  );
  return rows[0] ?? null;
}

// ── Feed (participants only) ────────────────────────────────────────────

// Randomized project order (ORDER BY random() re-shuffles on every call),
// so no submission is systematically advantaged by list position. Never
// includes drafts, and never includes the caller's own team's submission —
// you can't vote for yourself. No vote counts are returned here: results
// stay hidden until an organizer publishes them (see /results below).
// Configurable per event: an organizer can close voting entirely
// (events.voting_open) — the feed reports that instead of quietly
// returning an empty list, so the frontend can show "voting is closed"
// rather than "nothing to vote on".
votingRouter.get(
  "/feed",
  requireAuth,
  requireRole("participant"),
  asyncHandler(async (req, res) => {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: "event_id is required" });

    const config = await getEventVotingConfig(event_id);
    if (!config) return res.status(404).json({ error: "event not found" });
    if (!config.voting_open) return res.json({ voting_open: false, projects: [] });

    const { rows } = await pool.query(
      `SELECT submissions.id, submissions.title, submissions.description, submissions.track,
              submissions.repo_url, submissions.demo_url, teams.name AS team_name,
              EXISTS(
                SELECT 1 FROM votes WHERE votes.submission_id = submissions.id AND votes.voter_id = $2
              ) AS has_voted
       FROM submissions
       JOIN teams ON teams.id = submissions.team_id
       WHERE teams.event_id = $1
         AND submissions.is_draft = false
         AND submissions.team_id != COALESCE(
           (SELECT team_id FROM team_members WHERE user_id = $2 LIMIT 1), 0
         )
       ORDER BY random()`,
      [event_id, req.user.id]
    );
    res.json({ voting_open: true, projects: rows });
  })
);

// ── Voting ───────────────────────────────────────────────────────────────

votingRouter.post(
  "/:submissionId/vote",
  requireAuth,
  requireRole("participant"),
  asyncHandler(async (req, res) => {
    const submissionId = Number(req.params.submissionId);

    const { rows: subRows } = await pool.query(
      `SELECT submissions.team_id, submissions.is_draft, teams.event_id
       FROM submissions JOIN teams ON teams.id = submissions.team_id
       WHERE submissions.id = $1`,
      [submissionId]
    );
    if (subRows.length === 0) return res.status(404).json({ error: "submission not found" });
    if (subRows[0].is_draft) return res.status(400).json({ error: "cannot vote for a draft submission" });

    const config = await getEventVotingConfig(subRows[0].event_id);
    if (!config?.voting_open) {
      return res.status(403).json({ error: "voting is closed for this event" });
    }
    const rateLimitMax = config.vote_rate_limit;

    const { rows: recentVotes } = await pool.query(
      `SELECT count(*)::int AS n FROM votes WHERE voter_id = $1 AND created_at > now() - interval '${RATE_LIMIT_WINDOW}'`,
      [req.user.id]
    );
    if (recentVotes[0].n >= rateLimitMax) {
      await logAudit(req.user.id, "RATE_LIMIT_TRIGGERED", `submission:${submissionId}`, { window: RATE_LIMIT_WINDOW, max: rateLimitMax });
      return res.status(429).json({ error: "too many votes too quickly — slow down and try again shortly" });
    }

    const { rows: myTeam } = await pool.query(
      "SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1",
      [req.user.id]
    );
    if (myTeam[0]?.team_id === subRows[0].team_id) {
      return res.status(400).json({ error: "you can't vote for your own team's submission" });
    }

    try {
      await pool.query(
        "INSERT INTO votes (submission_id, voter_id) VALUES ($1, $2)",
        [submissionId, req.user.id]
      );
    } catch (err) {
      if (err.code === "23505") {
        await logAudit(req.user.id, "VOTE_REJECTED_DUPLICATE", `submission:${submissionId}`);
        return res.status(409).json({ error: "you already voted for this submission" });
      }
      throw err;
    }

    await logAudit(req.user.id, "VOTE_CAST", `submission:${submissionId}`);
    res.status(201).json({ ok: true });
  })
);

// ── Comments (any authenticated role) ───────────────────────────────────

votingRouter.get(
  "/:submissionId/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT comments.id, comments.body, comments.created_at, users.name AS author_name, users.role AS author_role
       FROM comments JOIN users ON users.id = comments.user_id
       WHERE comments.submission_id = $1
       ORDER BY comments.created_at ASC`,
      [req.params.submissionId]
    );
    res.json(rows);
  })
);

votingRouter.post(
  "/:submissionId/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = (req.body?.body ?? "").trim();
    if (!body) return res.status(400).json({ error: "comment body is required" });
    if (body.length > 2000) return res.status(400).json({ error: "comment is too long (max 2000 characters)" });

    const { rows } = await pool.query(
      `INSERT INTO comments (submission_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [req.params.submissionId, req.user.id, body]
    );
    await logAudit(req.user.id, "COMMENT_POSTED", `submission:${req.params.submissionId}`);
    res.status(201).json(rows[0]);
  })
);

// ── Results (hidden until published) ────────────────────────────────────

votingRouter.get(
  "/results",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: "event_id is required" });

    const { rows: eventRows } = await pool.query("SELECT results_published FROM events WHERE id = $1", [event_id]);
    if (eventRows.length === 0) return res.status(404).json({ error: "event not found" });

    const published = eventRows[0].results_published;
    const staff = req.user.role === "organizer" || req.user.role === "admin";
    if (!published && !staff) {
      return res.status(403).json({ error: "voting results are not published yet", published: false });
    }

    const { rows } = await pool.query(
      `SELECT submissions.id AS submission_id, submissions.title, teams.name AS team_name,
              count(votes.id)::int AS vote_count
       FROM submissions
       JOIN teams ON teams.id = submissions.team_id
       LEFT JOIN votes ON votes.submission_id = submissions.id
       WHERE teams.event_id = $1 AND submissions.is_draft = false
       GROUP BY submissions.id, teams.name
       ORDER BY vote_count DESC, submissions.title ASC`,
      [event_id]
    );
    res.json({ published, results: rows });
  })
);

votingRouter.post(
  "/publish",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const { event_id, published = true } = req.body ?? {};
    if (!event_id) return res.status(400).json({ error: "event_id is required" });
    await pool.query("UPDATE events SET results_published = $1 WHERE id = $2", [published, event_id]);
    await logAudit(req.user.id, published ? "RESULTS_PUBLISHED" : "RESULTS_UNPUBLISHED", `event:${event_id}`);
    res.json({ ok: true, published });
  })
);
