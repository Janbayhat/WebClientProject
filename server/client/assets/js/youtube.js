// assets/js/youtube.js

function iso8601DurationToSeconds(d) {
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

/**
 * Client-side YouTube search
 * IMPORTANT:
 * - No API key here
 * - Calls our server proxy
 */
export async function searchYouTube(query, maxResults = 12) {
  const url = `/api/youtube/search?q=${encodeURIComponent(query)}&max=${maxResults}`;

  const res = await fetch(url, {
    credentials: "include" // keep cookies consistent
  });

  if (!res.ok) {
    throw new Error("YouTube search failed");
  }

  const raw = await res.json();

  // Server returns ISO 8601 durations, normalize here to seconds
  return raw.map(v => ({
    videoId: v.videoId,
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    durationSec: iso8601DurationToSeconds(v.duration),
    views: Number(v.views || 0)
  }));
}
