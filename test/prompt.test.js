import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRequest,
  cleanPageText,
  ATTACHMENT_NAME,
  ATTACHMENT_NOTE,
  INLINE_LIMIT,
  TRUNCATION_NOTE,
} from "../src/prompt.js";

const VIDEO = "Provide an elaborate summary of that video.";
const PAGE = "Provide an elaborate summary of this page.";

test("puts the video instruction before a YouTube video address", () => {
  assert.deepEqual(
    buildRequest({ address: "https://youtu.be/dQw4w9WgXcQ?t=10", videoInstruction: VIDEO, pageInstruction: PAGE }),
    { text: `${VIDEO}\n\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ` },
  );
});

test("ignores page content for a YouTube video", () => {
  assert.deepEqual(
    buildRequest({
      address: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoInstruction: VIDEO,
      page: { title: "Video", text: "Comments and sidebar" },
    }),
    { text: `${VIDEO}\n\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ` },
  );
});

test("sends only the video address when the video instruction is empty", () => {
  assert.deepEqual(buildRequest({ address: "https://www.youtube.com/shorts/dQw4w9WgXcQ", videoInstruction: "  " }), {
    text: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  });
});

test("puts the page instruction, address, title and text for a web page", () => {
  assert.deepEqual(
    buildRequest({
      address: "https://example.com/article",
      videoInstruction: VIDEO,
      pageInstruction: PAGE,
      page: { title: "  An   article ", text: "First paragraph.\n\n\n\nSecond   paragraph." },
    }),
    { text: `${PAGE}\n\nhttps://example.com/article\n\nTitle: An article\n\nFirst paragraph.\n\nSecond paragraph.` },
  );
});

test("sends the page instruction and address when the page text is unavailable", () => {
  assert.deepEqual(buildRequest({ address: "https://example.com/other", pageInstruction: PAGE }), {
    text: `${PAGE}\n\nhttps://example.com/other`,
  });
});

test("treats YouTube pages that are not videos as web pages", () => {
  assert.deepEqual(
    buildRequest({ address: "https://www.youtube.com/@SomeChannel", videoInstruction: VIDEO, pageInstruction: PAGE }),
    { text: `${PAGE}\n\nhttps://www.youtube.com/@SomeChannel` },
  );
});

test("attaches long page text as a file, with a cut version as fallback", () => {
  const longText = Array.from({ length: 800 }, (_, i) => `Paragraph ${i} with some words in it.`).join("\n\n");
  const request = buildRequest({
    address: "https://example.com/long",
    pageInstruction: PAGE,
    page: { title: "Long page", text: longText },
  });
  assert.equal(request.text, `${PAGE}\n\nhttps://example.com/long\n\nTitle: Long page\n\n${ATTACHMENT_NOTE}`);
  assert.equal(request.attachment.name, ATTACHMENT_NAME);
  assert.ok(request.attachment.content.startsWith("Title: Long page\n\nhttps://example.com/long\n\nParagraph 0"));
  assert.ok(request.attachment.content.endsWith("Paragraph 799 with some words in it."));
  assert.ok(request.fallbackText.length <= INLINE_LIMIT);
  assert.ok(request.fallbackText.startsWith(`${PAGE}\n\nhttps://example.com/long\n\nTitle: Long page\n\nParagraph 0`));
  assert.ok(request.fallbackText.endsWith(TRUNCATION_NOTE));
});

test("rejects addresses that are not web pages", () => {
  assert.equal(buildRequest({ address: "about:blank", pageInstruction: PAGE }), null);
  assert.equal(buildRequest({ address: "file:///C:/notes.txt", pageInstruction: PAGE }), null);
  assert.equal(buildRequest({ address: undefined, pageInstruction: PAGE }), null);
});

test("cleans whitespace in page text", () => {
  assert.equal(cleanPageText("  a\u00a0 b \n\t c  \n\n\n\n d "), "a b\nc\n\nd");
});

test("cuts page text that is too long and says so", () => {
  const text = `${"word ".repeat(30)}\n${"more ".repeat(30)}`;
  const result = cleanPageText(text, 100);
  assert.ok(result.endsWith(TRUNCATION_NOTE));
  assert.ok(result.length < text.length);
});
