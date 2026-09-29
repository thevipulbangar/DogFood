import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;

// Everything a logged-in request needs to know about who's asking: their id
// and their role. We keep the token payload small on purpose.
export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, {
    expiresIn: "7d",
  });
}

// Reads "Authorization: Bearer <token>", verifies it, and attaches the
// decoded { id, role } to req.user. Rejects with 401 if missing/invalid.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing or malformed Authorization header" });
  }
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}

// Use after requireAuth: requireRole("organizer", "admin") lets only those
// roles through, everyone else gets 403.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden for this role" });
    }
    next();
  };
}
