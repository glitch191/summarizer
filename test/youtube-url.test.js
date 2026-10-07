import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeYouTubeUrl } from "../src/youtube-url.js";

const CANONICAL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const valid = [
  ["standard watch page", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  ["watch without www", "https://youtube.com/watch?v=dQw4w9WgXcQ"],
  ["mobile watch page", "https://m.youtube.com/watch?v=dQw4w9WgXcQ"],
  ["http scheme", "http://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  ["watch with playlist, index and time", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=4&t=42s"],
  ["watch with v not first", "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ"],
  ["watch with fragment", "https://www.youtube.com/watch?v=dQw4w9WgXcQ#comments"],
  ["short link", "https://youtu.be/dQw4w9WgXcQ"],
  ["short link with tracking and time", "https://youtu.be/dQw4w9WgXcQ?si=AbCdEf123&t=10"],
  ["shorts page", "https://www.youtube.com/shorts/dQw4w9WgXcQ"],
  ["mobile shorts with tracking", "https://m.youtube.com/shorts/dQw4w9WgXcQ?feature=share"],
  ["uppercase host", "https://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ"],
  ["surrounding whitespace", "  https://youtu.be/dQw4w9WgXcQ  "],
  ["embedded player", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
  ["embedded player with options", "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&start=30&rel=0"],
  ["privacy-enhanced embedded player", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
  ["privacy-enhanced player without www", "https://youtube-nocookie.com/embed/dQw4w9WgXcQ?list=PL123"],
];

for (const [name, input] of valid) {
  test(`normalizes ${name}`, () => {
    assert.equal(normalizeYouTubeUrl(input), CANONICAL);
  });
}

const invalid = [
  ["empty string", ""],
  ["not a URL", "not a url"],
  ["non-string value", undefined],
  ["YouTube home page", "https://www.youtube.com/"],
  ["search results", "https://www.youtube.com/results?search_query=test"],
  ["channel page", "https://www.youtube.com/@SomeChannel"],
  ["watch without v", "https://www.youtube.com/watch?list=PL123"],
  ["id with wrong length", "https://www.youtube.com/watch?v=short"],
  ["id with invalid characters", "https://youtu.be/dQw4w9WgX!Q"],
  ["other site", "https://example.com/watch?v=dQw4w9WgXcQ"],
  ["lookalike host", "https://youtube.com.example.com/watch?v=dQw4w9WgXcQ"],
  ["non-web scheme", "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  ["embedded playlist", "https://www.youtube.com/embed/videoseries?list=PL1234567890"],
  ["embed without id", "https://www.youtube.com/embed/"],
  ["privacy-enhanced watch page", "https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ"],
];

for (const [name, input] of invalid) {
  test(`rejects ${name}`, () => {
    assert.equal(normalizeYouTubeUrl(input), null);
  });
}
