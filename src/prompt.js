import { normalizeYouTubeUrl } from "./youtube-url.js";

// The Gemini prompt field holds about 32,000 characters and silently cuts the
// rest. Longer page text is sent as an attached text file instead.
export const INLINE_LIMIT = 30000;
// Upper bound for the attached file, to keep the upload reasonable.
export const MAX_FILE_TEXT = 1000000;
export const ATTACHMENT_NAME = "page-content.txt";
export const ATTACHMENT_NOTE = `The text of the page is in the attached file ${ATTACHMENT_NAME}.`;
export const TRUNCATION_NOTE = "[The page content was cut here because it is too long.]";

// Builds the request sent to Gemini for a page or link address:
//   { text }                              text for the prompt field
//   { text, attachment, fallbackText }    when the page text is too long:
//     text refers to the attached file, and fallbackText holds the page text
//     cut to fit the field, used if the file cannot be attached.
//
// YouTube video: the video instruction, an empty line, then the canonical
// video address.
// Any other web page: the page instruction, the address, then the page title
// and text when they could be read.
// Empty instructions are left out. Returns null when the address is not a
// web page.
export function buildRequest({ address, videoInstruction = "", pageInstruction = "", page = null }) {
  const videoUrl = normalizeYouTubeUrl(address);
  if (videoUrl) return { text: joinBlocks([videoInstruction.trim(), videoUrl]) };

  if (!isWebAddress(address)) return null;
  const url = address.trim();
  const fullText = cleanPageText(page?.text ?? "", MAX_FILE_TEXT);
  const title = fullText ? cleanLine(page?.title ?? "") : "";
  const head = [pageInstruction.trim(), url, title ? `Title: ${title}` : ""];

  const inline = joinBlocks([...head, fullText]);
  if (inline.length <= INLINE_LIMIT) return { text: inline };

  const room = INLINE_LIMIT - joinBlocks(head).length - TRUNCATION_NOTE.length - 8;
  return {
    text: joinBlocks([...head, ATTACHMENT_NOTE]),
    attachment: {
      name: ATTACHMENT_NAME,
      content: joinBlocks([title ? `Title: ${title}` : "", url, fullText]),
    },
    fallbackText: joinBlocks([...head, cleanPageText(fullText, room)]),
  };
}

// Normalizes page text for the prompt: trims each line, collapses runs of
// spaces, keeps at most one empty line between paragraphs, and cuts text that
// is too long.
export function cleanPageText(text, maxLength = INLINE_LIMIT) {
  if (typeof text !== "string") return "";
  const cleaned = text
    .split(/\r?\n/)
    .map(cleanLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  const cut = cleaned.slice(0, maxLength);
  const lastBreak = cut.lastIndexOf("\n");
  return `${(lastBreak > maxLength * 0.8 ? cut.slice(0, lastBreak) : cut).trim()}\n\n${TRUNCATION_NOTE}`;
}

function cleanLine(line) {
  return line.replace(/[\s ]+/g, " ").trim();
}

function joinBlocks(blocks) {
  return blocks.filter(Boolean).join("\n\n");
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
