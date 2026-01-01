// assets/js/search.js
import { requireAuthOrRedirect } from "./auth.js";
import { renderHeader } from "./header.js";
import { searchYouTube, formatDuration } from "./youtube.js";
import { api } from "./api.js";
import { openModal, closeModal, showToast } from "./ui.js";

let currentUser;
let lastResults = [];
let cachedPlaylists = [];

function isVideoInAnyPlaylist(playlists, videoId) {
  return playlists.some(pl => pl.items.some(it => it.videoId === videoId));
}

function setQueryString(q) {
  const url = new URL(window.location.href);
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  history.replaceState({}, "", url.toString());
}

function getQueryStringQ() {
  const url = new URL(window.location.href);
  return url.searchParams.get("q") || "";
}

async function refreshPlaylists() {
  const res = await api("/api/playlists");
  cachedPlaylists = res.playlists || [];
  return cachedPlaylists;
}

function renderCards(videos) {
  const host = document.getElementById("results");
  host.innerHTML = "";

  for (const v of videos) {
    const already = isVideoInAnyPlaylist(cachedPlaylists, v.videoId);

    const card = document.createElement("div");
    card.className = "video-card";

    const title = document.createElement("div");
    title.className = "video-card__title clamp-2";
    title.textContent = v.title;
    title.title = v.title; // tooltip

    const thumb = document.createElement("img");
    thumb.className = "video-card__thumb";
    thumb.src = v.thumbnailUrl;
    thumb.alt = v.title;

    const meta = document.createElement("div");
    meta.className = "video-card__meta";
    meta.innerHTML = `
      <div><strong>Duration:</strong> ${formatDuration(v.durationSec)}</div>
      <div><strong>Views:</strong> ${Number(v.views).toLocaleString()}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "video-card__actions";
    actions.innerHTML = `
      <button class="btn btn--small" data-action="play">Play</button>
      <button class="btn btn--small ${already ? "btn--disabled" : ""}" data-action="fav" ${already ? "disabled" : ""}>
        ${already ? "✓ In favorites" : "Add to playlist"}
      </button>
    `;

    const openPlayer = () => {
      const iframe = document.getElementById("playerFrame");
      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(v.videoId)}?autoplay=1`;
      openModal("playerModal");
    };
    thumb.onclick = openPlayer;
    title.onclick = openPlayer;

    actions.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.dataset.action;
      if (act === "play") openPlayer;
      if (act === "fav") openAddToPlaylistDialog(v);
    });

    if (already) {
      const check = document.createElement("div");
      check.className = "video-card__check";
      check.textContent = "✓";
      card.appendChild(check);
    }

    card.appendChild(thumb);
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(actions);
    host.appendChild(card);
  }
}

function openAddToPlaylistDialog(video) {
  const select = document.getElementById("plSelect");
  const newName = document.getElementById("newPlName");
  const saveBtn = document.getElementById("addConfirmBtn");

  select.innerHTML = `<option value="">-- Select existing --</option>`;
  for (const pl of cachedPlaylists) {
    const opt = document.createElement("option");
    opt.value = pl.id;
    opt.textContent = pl.name;
    select.appendChild(opt);
  }

  newName.value = "";

  saveBtn.onclick = async () => {
    try {
      const chosenId = select.value;
      const typedName = newName.value.trim();

      if (!chosenId && !typedName) {
        alert("Choose an existing playlist or type a new playlist name.");
        return;
      }

      let targetId = chosenId;

      // If creating new playlist, call server to create it first
      if (!targetId) {
        const created = await api("/api/playlists", { method: "POST", body: { name: typedName } });
        targetId = created.playlist.id;
      }

      // Add item to playlist on server
      await api(`/api/playlists/${encodeURIComponent(targetId)}/items`, {
        method: "POST",
        body: {
          item: {
            videoId: video.videoId,
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            durationSec: video.durationSec,
            views: video.views,
            rating: 0
          }
        }
      });

      closeModal("addModal");

      showToast("Saved to playlist", {
        actionText: "Go to playlist",
        actionHref: `playlists.html?playlistId=${encodeURIComponent(targetId)}`
      });

      await refreshPlaylists();
      renderCards(lastResults);
    } catch (e) {
      alert(e.message || "Failed to save.");
    }
  };

  openModal("addModal");
}

async function doSearch(q) {
  if (!q) return;

  setQueryString(q);
  sessionStorage.setItem("lastSearchQuery", q);

  const status = document.getElementById("status");
  status.textContent = "Searching...";

  try {
    lastResults = await searchYouTube(q);
    status.textContent = lastResults.length ? `Results for "${q}"` : "No results.";

    await refreshPlaylists();
    renderCards(lastResults);
  } catch (e) {
    status.textContent = "Search failed.";
  }
}

function restoreState() {
  const input = document.getElementById("q");
  const qsQ = getQueryStringQ();
  const last = sessionStorage.getItem("lastSearchQuery") || "";
  const q = qsQ || last;
  input.value = q;
  if (q) doSearch(q);
}

function wireModals() {
  document.getElementById("playerCloseBtn").onclick = () => {
    document.getElementById("playerFrame").src = "";
    closeModal("playerModal");
  };
  document.getElementById("addCancelBtn").onclick = () => closeModal("addModal");
}

function wireForm() {
  const form = document.getElementById("searchForm");
  const input = document.getElementById("q");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    doSearch(q);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await requireAuthOrRedirect();
  if (!currentUser) return;

  await renderHeader();
  wireModals();
  wireForm();
  restoreState();
});
