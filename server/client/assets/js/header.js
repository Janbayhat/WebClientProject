// assets/js/header.js
import { getCurrentUserCached, fetchMe, logout } from "./auth.js";
import { escapeHtml } from "./ui.js";

export async function renderHeader() {
  const slot = document.getElementById("userHeader");
  if (!slot) return;

  let u = getCurrentUserCached();
  if (!u) {
    try {
      u = await fetchMe();
    } catch {
      slot.innerHTML = `<div class="userbar__anon">Not logged in</div>`;
      return;
    }
  }

  slot.innerHTML = `
    <div class="userbar">
      <img class="userbar__img" src="${escapeHtml(u.imageUrl)}" alt="User image">
      <div class="userbar__name">${escapeHtml(u.username)}</div>
      <button id="logoutBtn" class="btn btn--ghost" type="button">Logout</button>
    </div>
  `;

  document.getElementById("logoutBtn").onclick = () => logout();
}
