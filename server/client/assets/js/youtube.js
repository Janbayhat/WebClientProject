// assets/js/youtube.js
const API_KEY = "AIzaSyCQIhMliRh0d2AnpBFYZoYFiaddoVETfZQ";

function iso8601DurationToSeconds(d) {
  // PT#H#M#S parsing
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d);
  if (!m) return 0;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + min * 60 + s;
}

export function formatDuration(sec) {
  const s = Math.max(0, sec | 0);
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export async function searchYouTube(query, maxResults = 12) {
  const q = encodeURIComponent(query);
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${q}&key=${API_KEY}`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error("YouTube search failed");
  const searchJson = await searchRes.json();

  const videoIds = searchJson.items.map(it => it.id.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  const detailsUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds.join(",")}&key=${API_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  if (!detailsRes.ok) throw new Error("YouTube details failed");
  const detailsJson = await detailsRes.json();

  return detailsJson.items.map(v => ({
    videoId: v.id,
    title: v.snippet.title,
    thumbnailUrl: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
    durationSec: iso8601DurationToSeconds(v.contentDetails.duration),
    views: Number(v.statistics.viewCount || 0),
  }));
}
