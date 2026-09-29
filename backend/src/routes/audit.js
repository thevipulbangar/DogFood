import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";

export const auditRouter = Router();

// Read-only view of the append-only audit_log table. Organizer/admin only —
// it can include information about any participant's voting activity.
auditRouter.get(
  "/",
  requireAuth,
  requireRole("organizer", "admin"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { rows } = await pool.query(
      `SELECT audit_log.id, audit_log.action, audit_log.object, audit_log.metadata, audit_log.created_at,
              users.name AS actor_name, users.role AS actor_role
       FROM audit_log
       LEFT JOIN users ON users.id = audit_log.actor_id
       ORDER BY audit_log.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(rows);
  })
);
