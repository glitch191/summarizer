// Turns any supported YouTube video address into the canonical form
// https://www.youtube.com/watch?v=<id>, dropping playlist, time and tracking
// parameters. Embedded players (/embed/<id>, including the privacy-enhanced
// youtube-nocookie.com) are supported too. Returns null when the address is
// not a YouTube video.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const EMBED_HOSTS = new Set([...YOUTUBE_HOSTS, "youtube-nocookie.com", "www.youtube-nocookie.com"]);
// Embedded playlists use /embed/videoseries?list=..., which is not a video.
const PLAYLIST_EMBED = "videoseries";

export function normalizeYouTubeUrl(input) {
  if (typeof input !== "string") return null;

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  let id = null;

  if (host === "youtu.be") {
    id = url.pathname.split("/")[1];
  } else if (EMBED_HOSTS.has(host)) {
    const parts = url.pathname.split("/");
    if (parts[1] === "embed") {
      id = parts[2];
    } else if (YOUTUBE_HOSTS.has(host) && (url.pathname === "/watch" || url.pathname === "/watch/")) {
      id = url.searchParams.get("v");
    } else if (YOUTUBE_HOSTS.has(host) && parts[1] === "shorts") {
      id = parts[2];
    }
  }

  if (!id || id === PLAYLIST_EMBED || !VIDEO_ID.test(id)) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}
