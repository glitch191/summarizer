import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "../src/prompt.js";

const INSTRUCTION = "Provide an elaborate summary of that video.";

test("puts the instruction before a YouTube video address", () => {
  assert.equal(
    buildPrompt("https://youtu.be/dQw4w9WgXcQ?t=10", INSTRUCTION),
    `${INSTRUCTION}\n\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ`,
  );
});

test("sends only the video address when the instruction is empty", () => {
  assert.equal(buildPrompt("https://www.youtube.com/shorts/dQw4w9WgXcQ", "  "), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

test("sends only the address of any other web page", () => {
  assert.equal(buildPrompt("https://example.com/article?id=3", INSTRUCTION), "https://example.com/article?id=3");
});

test("treats YouTube pages that are not videos as other pages", () => {
  assert.equal(buildPrompt("https://www.youtube.com/@SomeChannel", INSTRUCTION), "https://www.youtube.com/@SomeChannel");
});

test("rejects addresses that are not web pages", () => {
  assert.equal(buildPrompt("about:blank", INSTRUCTION), null);
  assert.equal(buildPrompt("file:///C:/notes.txt", INSTRUCTION), null);
  assert.equal(buildPrompt(undefined, INSTRUCTION), null);
});
