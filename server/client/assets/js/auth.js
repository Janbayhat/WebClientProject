// assets/js/auth.js
import { api } from "./api.js";

const CURRENT_USER_KEY = "currentUser";

export function getCurrentUserCached() {
  try {
    const raw = sessionStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUserCached(userOrNull) {
  if (!userOrNull) sessionStorage.removeItem(CURRENT_USER_KEY);
  else sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userOrNull));
}

export async function fetchMe() {
  const res = await api("/api/me");
  setCurrentUserCached(res.user);
  return res.user;
}

export async function requireAuthOrRedirect() {
  // Try cache first for instant render; verify with server.
  const cached = getCurrentUserCached();
  if (cached) return cached;

  try {
    const u = await fetchMe();
    return u;
  } catch {
    window.location.href = "login.html";
    return null;
  }
}

export async function registerUser({ username, password, confirmPassword, firstName, imageUrl }) {
  try {
    await api("/api/auth/register", {
      method: "POST",
      body: { username, password, confirmPassword, firstName, imageUrl }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || "Registration failed." };
  }
}

export async function loginUser(username, password) {
  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { username, password }
    });
    // server returns user on login
    setCurrentUserCached(res.user);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || "Login failed." };
  }
}

export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    setCurrentUserCached(null);
    window.location.href = "index.html";
  }
}
