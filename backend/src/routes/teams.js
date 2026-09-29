import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";

export const teamsRouter = Router();

function generateInviteCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A1B2C3D4"
}

// The team (+ members + submission) the logged-in user belongs to. A user
// is assumed to be on at most one team at a time — if they're on several
// (across different events), this returns the most recently joined one.
teamsRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT teams.*, events.name AS event_name, events.submission_deadline,
              events.tracks AS event_tracks
       FROM teams
       JOIN team_members ON team_members.team_id = teams.id
       JOIN events ON events.id = teams.event_id
       WHERE team_members.user_id = $1
       ORDER BY team_members.joined_at DESC
       LIMIT 1`,
      [req.user.id]
    );
    const team = rows[0];
    if (!team) return res.json({ team: null, members: [], submission: null });

    const { rows: members } = await pool.query(
      `SELECT users.id, users.name, users.email
       FROM team_members
       JOIN users ON users.id = team_members.user_id
       WHERE team_members.team_id = $1
       ORDER BY team_members.joined_at ASC`,
      [team.id]
    );

    const { rows: subRows } = await pool.query(
      "SELECT * FROM submissions WHERE team_id = $1",
      [team.id]
    );

    res.json({ team, members, submission: subRows[0] ?? null });
  })
);

// Organizer/admin visibility into every team for an event: who's on it,
// and whether they've submitted yet. Used by the organizer's teams
// dashboard — participants only ever see their own team via GET /me.
teamsRouter.get(
  "/",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const { event_id } = req.query;
    const { rows: teams } = await pool.query(
      `SELECT teams.*, events.name AS event_name
       FROM teams JOIN events ON events.id = teams.event_id
       WHERE ($1::int IS NULL OR teams.event_id = $1)
       ORDER BY teams.id`,
      [event_id ?? null]
    );
    if (teams.length === 0) return res.json([]);

    const teamIds = teams.map((t) => t.id);
    const { rows: members } = await pool.query(
      `SELECT team_members.team_id, users.id, users.name, users.email
       FROM team_members JOIN users ON users.id = team_members.user_id
       WHERE team_members.team_id = ANY($1::int[])
       ORDER BY team_members.joined_at ASC`,
      [teamIds]
    );
    const { rows: submissions } = await pool.query(
      `SELECT team_id, id, title, is_draft, submitted_at
       FROM submissions WHERE team_id = ANY($1::int[])`,
      [teamIds]
    );

    const membersByTeam = new Map();
    for (const m of members) {
      if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
      membersByTeam.get(m.team_id).push({ id: m.id, name: m.name, email: m.email });
    }
    const submissionByTeam = new Map(submissions.map((s) => [s.team_id, s]));

    res.json(
      teams.map((t) => ({
        ...t,
        members: membersByTeam.get(t.id) ?? [],
        submission: submissionByTeam.get(t.id) ?? null,
      }))
    );
  })
);

// Any logged-in user can start a team for an event; they become its first member.
teamsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { event_id, name } = req.body ?? {};
    if (!event_id || !name) {
      return res.status(400).json({ error: "event_id and name are required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inviteCode = generateInviteCode();
      const { rows } = await client.query(
        `INSERT INTO teams (event_id, name, invite_code, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [event_id, name, inviteCode, req.user.id]
      );
      const team = rows[0];
      await client.query(
        `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)`,
        [team.id, req.user.id]
      );
      await client.query("COMMIT");
      res.status(201).json(team);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

// Join an existing team with its invite code.
teamsRouter.post(
  "/join",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code } = req.body ?? {};
    if (!code) return res.status(400).json({ error: "code is required" });

    const { rows: teamRows } = await pool.query(
      "SELECT * FROM teams WHERE invite_code = $1",
      [code]
    );
    const team = teamRows[0];
    if (!team) return res.status(404).json({ error: "invalid invite code" });

    try {
      await pool.query(
        `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)`,
        [team.id, req.user.id]
      );
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "already a member of this team" });
      }
      throw err;
    }

    res.status(201).json(team);
  })
);
