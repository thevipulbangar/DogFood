import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool } from "../db.js";
import { signToken } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";

export const authRouter = Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Never store the raw token — only its hash. The raw one only ever exists
// in the link we hand back (URL param), same idea as a session cookie.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Public sign-up always creates a "participant" — judge/organizer/admin
// accounts are granted later by an organizer/admin, not self-selected here.
authRouter.post("/signup", asyncHandler(async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'participant') RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "email already in use" });
    }
    throw err;
  }
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { rows } = await pool.query(
    "SELECT id, name, email, role, password_hash FROM users WHERE email = $1",
    [email]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "invalid email or password" });
  }

  delete user.password_hash;
  res.json({ token: signToken(user), user });
}));

// Always responds the same way whether or not the email exists, so a caller
// can't use this to find out which emails have accounts. There's no SMTP in
// this self-hosted stack (deliberately — "no external services"), so the
// reset link is logged server-side instead of emailed: an admin with
// container access (`docker compose logs backend`) can hand it to the user.
// ponytail: swap the console.log for a real mailer if this instance is
// exposed to the internet and users can't reach the server logs.
authRouter.post("/forgot-password", asyncHandler(async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "email is required" });

  const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashToken(token), expiresAt]
    );
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    console.log(`password reset requested for ${email}: ${appUrl}/reset-password?token=${token}`);
  }

  res.json({ message: "If an account exists for that email, a reset link has been created." });
}));

authRouter.post("/reset-password", asyncHandler(async (req, res) => {
  const { token, password } = req.body ?? {};
  if (!token || !password) {
    return res.status(400).json({ error: "token and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const { rows } = await pool.query(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hashToken(token)]
  );
  const resetToken = rows[0];
  if (!resetToken) {
    return res.status(400).json({ error: "reset link is invalid or has expired" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      resetToken.user_id,
    ]);
    await client.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [
      resetToken.id,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json({ message: "Password updated. You can now sign in." });
}));
