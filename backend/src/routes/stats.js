import { Router } from "express";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";

export const statsRouter = Router();

// Public, aggregate-only counts for the marketing homepage. No login
// required, no per-record data returned — just how many of each thing
// exist, the same numbers anyone could get by paging through /api/gallery
// and /api/events.
statsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [{ rows: events }, { rows: teams }, { rows: submissions }] = await Promise.all([
      pool.query("SELECT count(*)::int AS n FROM events"),
      pool.query("SELECT count(*)::int AS n FROM teams"),
      pool.query("SELECT count(*)::int AS n FROM submissions WHERE is_draft = false"),
    ]);
    res.json({ events: events[0].n, teams: teams[0].n, submissions: submissions[0].n });
  })
);
