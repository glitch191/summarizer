import { normalizeYouTubeUrl } from "./youtube-url.js";

// Builds the text sent to Gemini for a page or link address.
// YouTube videos: the instruction, an empty line, then the canonical video
// address (or only the address when the instruction is empty).
// Any other web page: only its address.
// Returns null when the address is not a web page.
export function buildPrompt(address, instruction = "") {
  const videoUrl = normalizeYouTubeUrl(address);
  if (videoUrl) {
    const text = instruction.trim();
    return text ? `${text}\n\n${videoUrl}` : videoUrl;
  }
  return isWebAddress(address) ? address.trim() : null;
}

function isWebAddress(address) {
  if (typeof address !== "string") return false;
  try {
    const { protocol } = new URL(address.trim());
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
