import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";


import { readJson, writeJson, uid } from "./lib/storage.js";
import { hashPassword, createSession, deleteSession, requireAuth } from "./lib/auth.js";

const app = express();
const PORT = process.env.PORT || 3001;

// If you serve client from a different origin during dev, keep CORS enabled.
// If client and server are same origin, you can remove cors() entirely.
app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.static(path.join(process.cwd(), "client")));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ---------- Users ----------
async function loadUsers() {
  return await readJson("users.json", []);
}
async function saveUsers(users) {
  await writeJson("users.json", users);
}

// ---------- Playlists ----------
async function loadPlaylists() {
  return await readJson("playlists.json", []);
}
async function savePlaylists(playlists) {
  await writeJson("playlists.json", playlists);
}

// Utility: validate password rules (>=6, letter, digit, special)
function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 6) return "Password must be at least 6 characters.";
  if (!/[A-Za-z]/.test(pw)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one digit.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain at least one special character.";
  return null;
}

function publicUser(u) {
  return { username: u.username, firstName: u.firstName, imageUrl: u.imageUrl };
}

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Register
app.post("/api/auth/register", async (req, res) => {
  const { username, password, confirmPassword, firstName, imageUrl } = req.body || {};

  if (!username || !password || !confirmPassword || !firstName || !imageUrl) {
    return res.status(400).json({ ok: false, error: "All fields are required." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ ok: false, error: "Passwords do not match." });
  }
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ ok: false, error: pwErr });

  const users = await loadUsers();
  const exists = users.some(u => u.username.toLowerCase() === String(username).toLowerCase());
  if (exists) return res.status(409).json({ ok: false, error: "Username already exists." });

  const user = {
    username: String(username),
    passwordHash: hashPassword(password),
    firstName: String(firstName),
    imageUrl: String(imageUrl)
  };

  users.push(user);
  await saveUsers(users);

  return res.json({ ok: true });
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Username and password required." });
  }

  const users = await loadUsers();
  const user = users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) return res.status(401).json({ ok: false, error: "Invalid username or password." });

  const passwordHash = hashPassword(password);
  if (passwordHash !== user.passwordHash) {
    return res.status(401).json({ ok: false, error: "Invalid username or password." });
  }

  const sid = createSession(user.username);
  res.cookie("sid", sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: false // set true if HTTPS
  });

  return res.json({ ok: true, user: publicUser(user) });
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) deleteSession(sid);
  res.clearCookie("sid");
  return res.json({ ok: true });
});

// Me
app.get("/api/me", requireAuth, async (req, res) => {
  const users = await loadUsers();
  const user = users.find(u => u.username === req.auth.username);
  if (!user) return res.status(401).json({ ok: false, error: "Not authenticated" });
  return res.json({ ok: true, user: publicUser(user) });
});

// ---------- Playlists endpoints (authenticated) ----------

// Get all playlists for current user
app.get("/api/playlists", requireAuth, async (req, res) => {
  const all = await loadPlaylists();
  const mine = all.filter(p => p.username === req.auth.username);
  return res.json({ ok: true, playlists: mine });
});

// Create playlist
app.post("/api/playlists", requireAuth, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ ok: false, error: "Playlist name required." });
  }

  const all = await loadPlaylists();
  const pl = {
    id: uid("pl"),
    username: req.auth.username,
    name: String(name).trim(),
    items: [],
    createdAt: new Date().toISOString()
  };

  all.push(pl);
  await savePlaylists(all);

  return res.json({ ok: true, playlist: pl });
});

// Delete playlist
app.delete("/api/playlists/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const all = await loadPlaylists();

  const before = all.length;
  const filtered = all.filter(p => !(p.username === req.auth.username && p.id === id));
  if (filtered.length === before) {
    return res.status(404).json({ ok: false, error: "Playlist not found." });
  }

  await savePlaylists(filtered);
  return res.json({ ok: true });
});

// Add item to playlist
app.post("/api/playlists/:id/items", requireAuth, async (req, res) => {
  const id = req.params.id;
  const item = req.body?.item;

  if (!item || !item.videoId || !item.title) {
    return res.status(400).json({ ok: false, error: "Invalid item payload." });
  }

  const all = await loadPlaylists();
  const pl = all.find(p => p.username === req.auth.username && p.id === id);
  if (!pl) return res.status(404).json({ ok: false, error: "Playlist not found." });

  const exists = pl.items.some(x => x.videoId === item.videoId);
  if (!exists) {
    pl.items.push({
      videoId: String(item.videoId),
      title: String(item.title),
      thumbnailUrl: String(item.thumbnailUrl || ""),
      durationSec: Number(item.durationSec || 0),
      views: Number(item.views || 0),
      addedAt: new Date().toISOString(),
      rating: Number(item.rating || 0)
    });
    await savePlaylists(all);
  }

  return res.json({ ok: true, playlist: pl });
});

// Update rating for an item
app.patch("/api/playlists/:id/items/:videoId", requireAuth, async (req, res) => {
  const { id, videoId } = req.params;
  const { rating } = req.body || {};
  const r = Number(rating);

  if (!Number.isFinite(r) || r < 0 || r > 5) {
    return res.status(400).json({ ok: false, error: "Rating must be 0..5." });
  }

  const all = await loadPlaylists();
  const pl = all.find(p => p.username === req.auth.username && p.id === id);
  if (!pl) return res.status(404).json({ ok: false, error: "Playlist not found." });

  const it = pl.items.find(x => x.videoId === videoId);
  if (!it) return res.status(404).json({ ok: false, error: "Item not found." });

  it.rating = r;
  await savePlaylists(all);

  return res.json({ ok: true, playlist: pl });
});

// Delete an item from playlist
app.delete("/api/playlists/:id/items/:videoId", requireAuth, async (req, res) => {
  const { id, videoId } = req.params;

  const all = await loadPlaylists();
  const pl = all.find(p => p.username === req.auth.username && p.id === id);
  if (!pl) return res.status(404).json({ ok: false, error: "Playlist not found." });

  const before = pl.items.length;
  pl.items = pl.items.filter(x => x.videoId !== videoId);
  if (pl.items.length === before) {
    return res.status(404).json({ ok: false, error: "Item not found." });
  }

  await savePlaylists(all);
  return res.json({ ok: true, playlist: pl });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
