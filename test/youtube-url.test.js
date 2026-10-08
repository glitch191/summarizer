import { test } from "node:test";
import assert from "node:assert/strict";
import { findTargetVideo, findYouTubeVideos, normalizeYouTubeUrl } from "../src/youtube-url.js";

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

const OTHER = "https://www.youtube.com/watch?v=aaaaaaaaaaa";

const mentions = [
  ["thumbnail image", "src=https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"],
  ["webp thumbnail", "srcset=https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp 2x"],
  ["thumbnail as background", 'url("https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg")'],
  ["lazy embedded player", "data-src=https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"],
  ["protocol-relative player", "src=//www.youtube.com/embed/dQw4w9WgXcQ"],
  ["watch address in an attribute", "data-url=https://www.youtube.com/watch?feature=x&v=dQw4w9WgXcQ"],
  ["short link", "href=https://youtu.be/dQw4w9WgXcQ"],
  ["lite-youtube element", "videoid=dQw4w9WgXcQ"],
  ["data attribute", "data-video-id=dQw4w9WgXcQ"],
  ["encoded in a frame address", "https://cdn.example.com/media.html?src=https://www.youtube.com/embed/dQw4w9WgXcQ&x=1"],
];

for (const [name, text] of mentions) {
  test(`finds a video in a ${name}`, () => {
    assert.deepEqual([...findYouTubeVideos(text)], [CANONICAL]);
  });
}

const noMentions = [
  ["unrelated attribute", "class=video-player"],
  ["bare id in an unrelated attribute", "data-id=dQw4w9WgXcQ"],
  ["lookalike host", "src=https://notyoutube.com/embed/dQw4w9WgXcQ"],
  ["embedded playlist", "src=https://www.youtube.com/embed/videoseries?list=PL123"],
  ["id that is too long", "src=https://i.ytimg.com/vi/dQw4w9WgXcQx/hqdefault.jpg"],
];

for (const [name, text] of noMentions) {
  test(`finds no video in a ${name}`, () => {
    assert.equal(findYouTubeVideos(text).size, 0);
  });
}

test("picks the video closest to the clicked element", () => {
  const levels = [["class=play-button"], ["src=https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", "class=x"]];
  assert.equal(findTargetVideo(levels), CANONICAL);
});

test("counts the same video mentioned twice as one", () => {
  const levels = [["src=https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg", "data-src=https://www.youtube.com/embed/dQw4w9WgXcQ"]];
  assert.equal(findTargetVideo(levels), CANONICAL);
});

test("gives up when several videos are equally close", () => {
  const levels = [["class=x"], ["videoid=dQw4w9WgXcQ", "videoid=aaaaaaaaaaa"], [`href=${OTHER}`]];
  assert.equal(findTargetVideo(levels), null);
});

test("finds nothing when no level mentions a video", () => {
  assert.equal(findTargetVideo([["class=x"], []]), null);
  assert.equal(findTargetVideo([]), null);
});
