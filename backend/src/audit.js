import { pool } from "./db.js";

// Append-only audit trail helper. Never throws into the caller's request —
// a logging failure shouldn't take down the action it's logging.
export async function logAudit(actorId, action, object, metadata) {
  try {
    await pool.query(
      "INSERT INTO audit_log (actor_id, action, object, metadata) VALUES ($1, $2, $3, $4)",
      [actorId ?? null, action, object ?? null, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error("audit log write failed:", err);
  }
}
