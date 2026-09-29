import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";

export const judgingRouter = Router();

const WEIGHT_EPSILON = 0.01;

// ── Rubric (organizer/admin) ───────────────────────────────────────────

// Replaces the full rubric for an event in one call, rather than adding
// criteria one at a time — that way "weights sum to 100" is one check
// against the whole set, not something that can drift as criteria are
// added/removed independently.
judgingRouter.post(
  "/rubric",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const { event_id, criteria } = req.body ?? {};
    if (!event_id || !Array.isArray(criteria) || criteria.length === 0) {
      return res.status(400).json({ error: "event_id and a non-empty criteria array are required" });
    }
    for (const c of criteria) {
      if (!c.name || typeof c.weight !== "number" || c.weight <= 0) {
        return res.status(400).json({ error: "each criterion needs a name and a positive weight" });
      }
    }
    const total = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(total - 100) > WEIGHT_EPSILON) {
      return res.status(400).json({ error: `criteria weights must sum to 100 (got ${total})` });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM rubric_criteria WHERE event_id = $1", [event_id]);
      const rows = [];
      for (const c of criteria) {
        const { rows: inserted } = await client.query(
          `INSERT INTO rubric_criteria (event_id, name, description, weight)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [event_id, c.name, c.description ?? null, c.weight]
        );
        rows.push(inserted[0]);
      }
      await client.query("COMMIT");
      res.status(201).json(rows);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

// Any logged-in user can see the rubric (judges need it to score, everyone
// benefits from knowing how projects are judged).
judgingRouter.get(
  "/rubric",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: "event_id is required" });
    const { rows } = await pool.query(
      "SELECT * FROM rubric_criteria WHERE event_id = $1 ORDER BY id",
      [event_id]
    );
    res.json(rows);
  })
);

// ── Assignment (organizer/admin) ───────────────────────────────────────

// Round-robin: list every judge, list every submitted (non-draft)
// submission for the event, and hand out judges_per_submission distinct
// judges to each submission, cycling through the judge list. Safe to call
// more than once — it skips any (judge, submission) pair that's already
// assigned (UNIQUE constraint + ON CONFLICT DO NOTHING), so re-running
// after adding a late judge only fills the gaps instead of duplicating.
judgingRouter.post(
  "/assign",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const { event_id, judges_per_submission = 3 } = req.body ?? {};
    if (!event_id) return res.status(400).json({ error: "event_id is required" });

    const { rows: judges } = await pool.query(
      "SELECT id FROM users WHERE role = 'judge' ORDER BY id"
    );
    if (judges.length === 0) {
      return res.status(400).json({ error: "no judges exist to assign" });
    }

    const { rows: submissions } = await pool.query(
      `SELECT submissions.id FROM submissions
       JOIN teams ON teams.id = submissions.team_id
       WHERE teams.event_id = $1 AND submissions.is_draft = false
       ORDER BY submissions.id`,
      [event_id]
    );

    const n = Math.min(judges_per_submission, judges.length);
    let cursor = 0;
    const created = [];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const submission of submissions) {
        for (let k = 0; k < n; k++) {
          const judge = judges[(cursor + k) % judges.length];
          const { rows } = await client.query(
            `INSERT INTO judge_assignments (event_id, judge_id, submission_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (judge_id, submission_id) DO NOTHING
             RETURNING *`,
            [event_id, judge.id, submission.id]
          );
          if (rows[0]) created.push(rows[0]);
        }
        cursor += n; // rotate the starting judge so load stays balanced
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json({
      submissions: submissions.length,
      judges: judges.length,
      judges_per_submission: n,
      assignments_created: created.length,
    });
  })
);

judgingRouter.get(
  "/assignments",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: "event_id is required" });
    const { rows } = await pool.query(
      `SELECT judge_assignments.*, users.name AS judge_name, users.email AS judge_email,
              submissions.title AS submission_title
       FROM judge_assignments
       JOIN users ON users.id = judge_assignments.judge_id
       JOIN submissions ON submissions.id = judge_assignments.submission_id
       WHERE judge_assignments.event_id = $1
       ORDER BY judge_assignments.submission_id, judge_assignments.judge_id`,
      [event_id]
    );
    res.json(rows);
  })
);

// ── A judge's own queue ─────────────────────────────────────────────────

judgingRouter.get(
  "/my-assignments",
  requireAuth,
  requireRole("judge"),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT judge_assignments.id, judge_assignments.status, judge_assignments.assigned_at,
              submissions.id AS submission_id, submissions.title, submissions.description,
              submissions.track, submissions.repo_url, submissions.demo_url
       FROM judge_assignments
       JOIN submissions ON submissions.id = judge_assignments.submission_id
       WHERE judge_assignments.judge_id = $1
       ORDER BY judge_assignments.id`,
      [req.user.id]
    );
    res.json(rows);
  })
);

// One assignment's detail: the submission, the event's rubric, and any
// scores already given. Only the assigned judge (or organizer/admin, to
// support reviewing/auditing) can view it.
judgingRouter.get(
  "/assignments/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT judge_assignments.*, submissions.title, submissions.description,
              submissions.track, submissions.repo_url, submissions.demo_url
       FROM judge_assignments
       JOIN submissions ON submissions.id = judge_assignments.submission_id
       WHERE judge_assignments.id = $1`,
      [req.params.id]
    );
    const assignment = rows[0];
    if (!assignment) return res.status(404).json({ error: "assignment not found" });
    if (assignment.judge_id !== req.user.id && !["organizer", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "not your assignment" });
    }

    const { rows: criteria } = await pool.query(
      "SELECT * FROM rubric_criteria WHERE event_id = $1 ORDER BY id",
      [assignment.event_id]
    );
    const { rows: scores } = await pool.query(
      "SELECT * FROM scores WHERE assignment_id = $1",
      [assignment.id]
    );
    res.json({ assignment, criteria, scores });
  })
);

// Upsert scores for one assignment. Strictly the assigned judge only (not
// even an admin can score on a judge's behalf) — that's a deliberate
// judging-integrity choice, documented in JUDGING.md.
judgingRouter.post(
  "/assignments/:id/scores",
  requireAuth,
  requireRole("judge"),
  asyncHandler(async (req, res) => {
    const { scores } = req.body ?? {};
    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: "a non-empty scores array is required" });
    }

    const { rows: assignmentRows } = await pool.query(
      "SELECT * FROM judge_assignments WHERE id = $1",
      [req.params.id]
    );
    const assignment = assignmentRows[0];
    if (!assignment) return res.status(404).json({ error: "assignment not found" });
    if (assignment.judge_id !== req.user.id) {
      return res.status(403).json({ error: "not your assignment" });
    }
    if (assignment.status === "completed") {
      return res.status(403).json({ error: "this assignment has already been submitted" });
    }

    for (const s of scores) {
      if (typeof s.criterion_id !== "number" || typeof s.raw_score !== "number") {
        return res.status(400).json({ error: "each score needs criterion_id and raw_score" });
      }
      if (s.raw_score < 0 || s.raw_score > 10) {
        return res.status(400).json({ error: "raw_score must be between 0 and 10" });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const s of scores) {
        await client.query(
          `INSERT INTO scores (assignment_id, criterion_id, raw_score, notes)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (assignment_id, criterion_id)
           DO UPDATE SET raw_score = $3, notes = $4, updated_at = now()`,
          [assignment.id, s.criterion_id, s.raw_score, s.notes ?? null]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.status(200).json({ saved: scores.length });
  })
);

// Locks the assignment in: every rubric criterion for the event must have
// a score first. Once completed, /scores above refuses further edits.
judgingRouter.post(
  "/assignments/:id/complete",
  requireAuth,
  requireRole("judge"),
  asyncHandler(async (req, res) => {
    const { rows: assignmentRows } = await pool.query(
      "SELECT * FROM judge_assignments WHERE id = $1",
      [req.params.id]
    );
    const assignment = assignmentRows[0];
    if (!assignment) return res.status(404).json({ error: "assignment not found" });
    if (assignment.judge_id !== req.user.id) {
      return res.status(403).json({ error: "not your assignment" });
    }

    const { rows: criteria } = await pool.query(
      "SELECT id FROM rubric_criteria WHERE event_id = $1",
      [assignment.event_id]
    );
    const { rows: scores } = await pool.query(
      "SELECT criterion_id FROM scores WHERE assignment_id = $1",
      [assignment.id]
    );
    const scored = new Set(scores.map((s) => s.criterion_id));
    const missing = criteria.filter((c) => !scored.has(c.id));
    if (missing.length > 0) {
      return res.status(400).json({ error: `${missing.length} criterion/criteria still unscored` });
    }

    const { rows } = await pool.query(
      "UPDATE judge_assignments SET status = 'completed', completed_at = now() WHERE id = $1 RETURNING *",
      [assignment.id]
    );
    res.json(rows[0]);
  })
);

// ── Results: cross-judge normalization ──────────────────────────────────

// Computes, for every completed assignment, a weighted raw total (0-10,
// using each criterion's weight/100 as its fraction of the total) and a
// per-judge z-score of that total. Z-score normalization corrects for
// judges who are systematically harsh or generous: a judge who gives
// everyone 6-7/10 and a judge who gives everyone 8-9/10 can disagree in
// absolute terms but agree in *relative* terms, and z-scoring surfaces
// that agreement instead of letting the harsh judge's projects lose purely
// because of their scale.
//
// A judge with fewer than 2 completed scores in this event has no
// variance to normalize against — their contribution is left as 0 rather
// than a misleading z-score, and this is called out explicitly in the
// response (`normalizable: false`) and in JUDGING.md.
async function computeResults(eventId) {
  const { rows: criteria } = await pool.query(
    "SELECT id, weight FROM rubric_criteria WHERE event_id = $1",
    [eventId]
  );
  const weightById = new Map(criteria.map((c) => [c.id, Number(c.weight) / 100]));

  const { rows: assignments } = await pool.query(
    `SELECT judge_assignments.id, judge_assignments.judge_id, judge_assignments.submission_id
     FROM judge_assignments
     WHERE judge_assignments.event_id = $1 AND judge_assignments.status = 'completed'`,
    [eventId]
  );

  const { rows: allScores } = await pool.query(
    `SELECT scores.assignment_id, scores.criterion_id, scores.raw_score
     FROM scores
     JOIN judge_assignments ON judge_assignments.id = scores.assignment_id
     WHERE judge_assignments.event_id = $1`,
    [eventId]
  );
  const scoresByAssignment = new Map();
  for (const s of allScores) {
    if (!scoresByAssignment.has(s.assignment_id)) scoresByAssignment.set(s.assignment_id, []);
    scoresByAssignment.get(s.assignment_id).push(s);
  }

  // weighted_total per assignment
  const weightedByAssignment = new Map();
  for (const a of assignments) {
    const scores = scoresByAssignment.get(a.id) ?? [];
    const total = scores.reduce((sum, s) => sum + Number(s.raw_score) * (weightById.get(s.criterion_id) ?? 0), 0);
    weightedByAssignment.set(a.id, total);
  }

  // Per-judge mean/stddev of their own weighted totals in this event.
  const byJudge = new Map();
  for (const a of assignments) {
    if (!byJudge.has(a.judge_id)) byJudge.set(a.judge_id, []);
    byJudge.get(a.judge_id).push(weightedByAssignment.get(a.id));
  }
  const judgeStats = new Map();
  for (const [judgeId, totals] of byJudge) {
    const n = totals.length;
    const mean = totals.reduce((s, x) => s + x, 0) / n;
    const variance = n > 1 ? totals.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
    const stddev = Math.sqrt(variance);
    judgeStats.set(judgeId, { mean, stddev, n, normalizable: n >= 2 && stddev > 0 });
  }

  // Per-submission: average normalized (and raw) score across the judges
  // who completed it.
  const bySubmission = new Map();
  for (const a of assignments) {
    if (!bySubmission.has(a.submission_id)) bySubmission.set(a.submission_id, []);
    const stats = judgeStats.get(a.judge_id);
    const raw = weightedByAssignment.get(a.id);
    // A judge with too little data to z-score (fewer than 2 completed
    // scores, or zero variance) falls back to their raw weighted total
    // instead of being silently zeroed out — see JUDGING.md.
    const normalized = stats.normalizable ? (raw - stats.mean) / stats.stddev : raw;
    bySubmission.get(a.submission_id).push({ judge_id: a.judge_id, raw, normalized, normalizable: stats.normalizable });
  }

  const { rows: submissions } = await pool.query(
    `SELECT submissions.id, submissions.title, teams.name AS team_name
     FROM submissions JOIN teams ON teams.id = submissions.team_id
     WHERE submissions.id = ANY($1::int[])`,
    [[...bySubmission.keys()]]
  );

  const results = submissions.map((s) => {
    const judgeScores = bySubmission.get(s.id) ?? [];
    const rawAvg = judgeScores.reduce((sum, j) => sum + j.raw, 0) / (judgeScores.length || 1);
    const normalizedAvg = judgeScores.reduce((sum, j) => sum + j.normalized, 0) / (judgeScores.length || 1);
    return {
      submission_id: s.id,
      title: s.title,
      team_name: s.team_name,
      judges_completed: judgeScores.length,
      raw_avg: Number(rawAvg.toFixed(3)),
      normalized_avg: Number(normalizedAvg.toFixed(3)),
      // false if any contributing judge fell back to a raw score because
      // they didn't yet have enough data to normalize against.
      fully_normalized: judgeScores.length > 0 && judgeScores.every((j) => j.normalizable),
    };
  });

  results.sort((a, b) => b.normalized_avg - a.normalized_avg);
  return results;
}

judgingRouter.get(
  "/results",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: "event_id is required" });
    res.json(await computeResults(event_id));
  })
);

// ── CSV export ───────────────────────────────────────────────────────────

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

judgingRouter.get(
  "/export.csv",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const { event_id, type = "results" } = req.query;
    if (!event_id) return res.status(400).json({ error: "event_id is required" });

    let rows;
    if (type === "results") {
      rows = await computeResults(event_id);
    } else if (type === "assignments") {
      ({ rows } = await pool.query(
        `SELECT judge_assignments.id, users.name AS judge_name, users.email AS judge_email,
                submissions.title AS submission_title, judge_assignments.status, judge_assignments.assigned_at
         FROM judge_assignments
         JOIN users ON users.id = judge_assignments.judge_id
         JOIN submissions ON submissions.id = judge_assignments.submission_id
         WHERE judge_assignments.event_id = $1
         ORDER BY judge_assignments.id`,
        [event_id]
      ));
    } else if (type === "scores") {
      ({ rows } = await pool.query(
        `SELECT scores.id, users.email AS judge_email, submissions.title AS submission_title,
                rubric_criteria.name AS criterion, scores.raw_score, scores.notes, scores.updated_at
         FROM scores
         JOIN judge_assignments ON judge_assignments.id = scores.assignment_id
         JOIN users ON users.id = judge_assignments.judge_id
         JOIN submissions ON submissions.id = judge_assignments.submission_id
         JOIN rubric_criteria ON rubric_criteria.id = scores.criterion_id
         WHERE judge_assignments.event_id = $1
         ORDER BY scores.id`,
        [event_id]
      ));
    } else {
      return res.status(400).json({ error: "type must be one of: results, assignments, scores" });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${type}.csv"`);
    res.send(toCsv(rows));
  })
);
