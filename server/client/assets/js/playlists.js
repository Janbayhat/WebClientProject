// assets/js/playlists.js
import { requireAuthOrRedirect } from "./auth.js";
import { renderHeader } from "./header.js";
import { api } from "./api.js";
import { openModal, closeModal, escapeHtml } from "./ui.js";

function getPlaylistIdFromQS() {
  const url = new URL(window.location.href);
  return url.searchParams.get("playlistId");
}

function setPlaylistIdQS(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("playlistId", id);
  else url.searchParams.delete("playlistId");
  history.replaceState({}, "", url.toString());
}

let currentUser;
let playlists = [];
let activePlaylistId = null;

async function refreshPlaylists() {
  const res = await api("/api/playlists");
  playlists = res.playlists || [];
  if (activePlaylistId && !playlists.some(p => p.id === activePlaylistId)) {
    activePlaylistId = playlists[0]?.id || null;
  }
  return playlists;
}

function renderSidebar() {
  const list = document.getElementById("plList");
  list.innerHTML = "";

  if (playlists.length === 0) {
    list.innerHTML = `<div class="muted">No playlists yet.</div>`;
    return;
  }

  for (const pl of playlists) {
    const btn = document.createElement("button");
    btn.className = `sidebar__item ${pl.id === activePlaylistId ? "is-active" : ""}`;
    btn.type = "button";
    btn.textContent = pl.name;
    btn.onclick = () => {
      activePlaylistId = pl.id;
      setPlaylistIdQS(pl.id);
      render();
    };
    list.appendChild(btn);
  }
}

function sortItems(items, mode) {
  if (mode === "alpha") return [...items].sort((a, b) => a.title.localeCompare(b.title));
  if (mode === "rating") return [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return items;
}

function renderMain() {
  const main = document.getElementById("mainContent");
  const pl = playlists.find(p => p.id === activePlaylistId);

  if (!pl) {
    main.innerHTML = `<div class="card">בחר פלייליסט מהרשימה.</div>`;
    return;
  }

  const filterText = (document.getElementById("filterInput").value || "").toLowerCase();
  const sortMode = document.getElementById("sortMode").value;

  let items = (pl.items || []).filter(it => it.title.toLowerCase().includes(filterText));
  items = sortItems(items, sortMode);

  const htmlItems = items.map(it => `
    <div class="pl-item">
      <img class="pl-item__thumb" src="${escapeHtml(it.thumbnailUrl)}" alt="">
      <div class="pl-item__body">
        <div class="pl-item__title">${escapeHtml(it.title)}</div>
        <div class="pl-item__controls">
          <label>Rating:
            <select data-videoid="${escapeHtml(it.videoId)}" class="ratingSelect">
              ${[0,1,2,3,4,5].map(r => `<option value="${r}" ${String(it.rating||0)===String(r)?"selected":""}>${r}</option>`).join("")}
            </select>
          </label>
          <button class="btn btn--small" data-del="${escapeHtml(it.videoId)}">Delete</button>
        </div>
      </div>
    </div>
  `).join("");

  main.innerHTML = `
    <div class="card">
      <div class="row space-between">
        <h2>${escapeHtml(pl.name)}</h2>
        <button id="deletePlaylistBtn" class="btn btn--danger" type="button">Delete playlist</button>
      </div>
      <div class="muted">${(pl.items || []).length} items</div>
    </div>
    <div class="card">
      ${htmlItems || `<div class="muted">No matches.</div>`}
    </div>
  `;

  // Rating change -> PATCH server
  main.querySelectorAll(".ratingSelect").forEach(sel => {
    sel.addEventListener("change", async () => {
      const vId = sel.dataset.videoid;
      const rating = Number(sel.value || 0);

      try {
        await api(`/api/playlists/${encodeURIComponent(activePlaylistId)}/items/${encodeURIComponent(vId)}`, {
          method: "PATCH",
          body: { rating }
        });

        await refreshPlaylists();
        // If sorted by rating, rerender to reflect order
        renderMain();
      } catch (e) {
        alert(e.message || "Failed to update rating.");
      }
    });
  });

  // Delete item -> DELETE server
  main.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const vId = btn.getAttribute("data-del");
      try {
        await api(`/api/playlists/${encodeURIComponent(activePlaylistId)}/items/${encodeURIComponent(vId)}`, {
          method: "DELETE"
        });
        await refreshPlaylists();
        render();
      } catch (e) {
        alert(e.message || "Failed to delete item.");
      }
    });
  });

  // Delete playlist -> DELETE server
  document.getElementById("deletePlaylistBtn").onclick = async () => {
    if (!confirm("Delete this playlist?")) return;
    try {
      await api(`/api/playlists/${encodeURIComponent(activePlaylistId)}`, { method: "DELETE" });
      await refreshPlaylists();
      activePlaylistId = playlists[0]?.id || null;
      setPlaylistIdQS(activePlaylistId);
      render();
    } catch (e) {
      alert(e.message || "Failed to delete playlist.");
    }
  };
}

function wireCreatePlaylistModal() {
  document.getElementById("newPlaylistBtn").onclick = () => {
    document.getElementById("newPlaylistName").value = "";
    openModal("newPlaylistModal");
  };
  document.getElementById("newPlaylistCancel").onclick = () => closeModal("newPlaylistModal");

  document.getElementById("newPlaylistCreate").onclick = async () => {
    const name = document.getElementById("newPlaylistName").value.trim();
    if (!name) return alert("Name required.");

    try {
      const created = await api("/api/playlists", { method: "POST", body: { name } });
      await refreshPlaylists();
      activePlaylistId = created.playlist.id;
      setPlaylistIdQS(activePlaylistId);
      closeModal("newPlaylistModal");
      render();
    } catch (e) {
      alert(e.message || "Failed to create playlist.");
    }
  };
}

function wireControls() {
  document.getElementById("filterInput").addEventListener("input", () => renderMain());
  document.getElementById("sortMode").addEventListener("change", () => renderMain());
}

function chooseInitialActive() {
  const qsId = getPlaylistIdFromQS();
  if (qsId && playlists.some(p => p.id === qsId)) return qsId;
  return playlists[0]?.id || null;
}

function render() {
  renderSidebar();
  renderMain();
}

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await requireAuthOrRedirect();
  if (!currentUser) return;

  await renderHeader();

  await refreshPlaylists();
  activePlaylistId = chooseInitialActive();
  setPlaylistIdQS(activePlaylistId);

  wireCreatePlaylistModal();
  wireControls();
  render();
});
