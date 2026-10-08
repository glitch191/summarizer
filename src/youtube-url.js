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

// Video ids found in arbitrary text: addresses of videos, embedded players and
// thumbnails (i.ytimg.com/vi/<id>/...), or attributes that hold a bare id,
// written as name=value (videoid=<id> on lite-youtube, data-video-id=<id>...).
const ID = String.raw`([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])`;
const ID_PATTERNS = [
  String.raw`//(?:[\w-]+\.)*youtube(?:-nocookie)?\.com/(?:embed|shorts|live|v)/${ID}`,
  String.raw`//(?:[\w-]+\.)*youtube\.com/watch\?(?:[^\s"'#]*?&)?v=${ID}`,
  String.raw`//youtu\.be/${ID}`,
  String.raw`//(?:[\w-]+\.)*(?:ytimg\.com|img\.youtube\.com)/vi(?:_webp)?/${ID}/`,
  String.raw`^(?:data-)?(?:video-?id|youtube-?(?:video-?)?id|yt-?id)=${ID}$`,
].map((source) => new RegExp(source, "gim"));

// Returns the canonical addresses of the YouTube videos mentioned in a text.
export function findYouTubeVideos(text) {
  const found = new Set();
  if (typeof text !== "string") return found;
  for (const pattern of ID_PATTERNS) {
    for (const [, id] of text.matchAll(pattern)) {
      if (id !== PLAYLIST_EMBED) found.add(`https://www.youtube.com/watch?v=${id}`);
    }
  }
  return found;
}

// Picks the video a right-click was aimed at. Each level holds the texts found
// around the clicked element, from the element itself outwards. The first
// level that mentions exactly one video gives the answer; a level that
// mentions several videos is ambiguous and stops the search.
export function findTargetVideo(levels) {
  for (const texts of levels) {
    const found = new Set();
    for (const text of texts) for (const video of findYouTubeVideos(text)) found.add(video);
    if (found.size === 1) return [...found][0];
    if (found.size > 1) return null;
  }
  return null;
}
