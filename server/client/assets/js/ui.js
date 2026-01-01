// assets/js/ui.js
export function showToast(message, { actionText, actionHref, durationMs = 4500 } = {}) {
  const host = document.getElementById("toastHost");
  if (!host) return alert(message);

  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `
    <div class="toast__msg">${escapeHtml(message)}</div>
    ${actionText && actionHref ? `<a class="toast__action" href="${actionHref}">${escapeHtml(actionText)}</a>` : ""}
    <button class="toast__close" aria-label="Close">×</button>
  `;

  el.querySelector(".toast__close").onclick = () => el.remove();
  host.appendChild(el);

  window.setTimeout(() => el.remove(), durationMs);
}

export function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (!m) return;
  m.classList.add("is-open");
  m.setAttribute("aria-hidden", "false");
}

export function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (!m) return;
  m.classList.remove("is-open");
  m.setAttribute("aria-hidden", "true");
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
