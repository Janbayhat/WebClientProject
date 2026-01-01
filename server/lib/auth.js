import crypto from "crypto";

const sessions = new Map(); // sid -> { username, createdAt }

export function hashPassword(password) {
  // Not "production secure", but acceptable for assignment persistence.
  // If you want better: scrypt with per-user salt.
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

export function createSession(username) {
  const sid = crypto.randomBytes(24).toString("hex");
  sessions.set(sid, { username, createdAt: Date.now() });
  return sid;
}

export function deleteSession(sid) {
  sessions.delete(sid);
}

export function getSession(sid) {
  return sid ? sessions.get(sid) : null;
}

export function requireAuth(req, res, next) {
  const sid = req.cookies?.sid;
  const s = getSession(sid);
  if (!s) return res.status(401).json({ ok: false, error: "Not authenticated" });
  req.auth = { username: s.username, sid };
  next();
}
