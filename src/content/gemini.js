// Runs on gemini.google.com. Asks the background page whether this tab has a
// pending summary request, fills the prompt field and sends it. In the popup
// window, also reports size and position changes so they can be restored.

/* global GEMINI_SELECTORS */

const WAIT_TIMEOUT_MS = 15000;
const SEND_TIMEOUT_MS = 5000;
const BOUNDS_POLL_MS = 1000;
const SETTLE_MS = 500;
const INSERT_CHECK_MS = 1000;

main().catch((error) => console.error("Summarize:", error));

async function main() {
  const response = await browser.runtime.sendMessage({ type: "getTask" });
  if (!response) return;
  if (response.isPopup) trackWindowBounds();
  if (response.task) await runTask(response.task);
}

// ---------------------------------------------------------------- filling

async function runTask({ text, sendAutomatically }) {
  const found = await waitFor(findEditor, WAIT_TIMEOUT_MS);
  if (!found) {
    const reason = findFirst(GEMINI_SELECTORS.signInLink)
      ? "You do not seem to be signed in to Google."
      : "The prompt field was not found within 15 seconds. The Gemini page layout may have changed.";
    return fail(text, reason);
  }
  if (findFirst(GEMINI_SELECTORS.signInLink)) {
    return fail(text, "You do not seem to be signed in to Google. Sign in first.");
  }

  // Gemini may replace the prompt field right after the page loads. Let the
  // page settle, then look for the field again.
  await sleep(SETTLE_MS);

  const lastLine = text.split("\n").pop();
  if (!(await insertText(text, lastLine))) {
    return fail(text, "The text could not be inserted into the prompt field.");
  }
  if (!sendAutomatically) return;

  const button = await waitFor(() => findFirst(GEMINI_SELECTORS.sendButton), SEND_TIMEOUT_MS);
  if (button) {
    button.click();
    return;
  }
  // No send button found: try the Enter key, then check that the field emptied.
  findEditor()?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true }),
  );
  await sleep(1000);
  if (editorText(findEditor()).includes(lastLine)) {
    showBanner("The prompt is filled in, but the send button was not found. Press Enter to send it.");
  }
}

// Tries several ways to put the text in the prompt field, from the closest to
// typing or pasting to a direct edit of the field. Gemini ignores synthetic
// paste events at the time of writing, so the insertText command comes first.
// Returns true when the text is in the field.
async function insertText(text, marker) {
  const strategies = [
    ["insertText command", insertWithCommand],
    ["paste event", pasteInto],
    ["direct edit", writeDirectly],
  ];
  for (const [name, strategy] of strategies) {
    const editor = findEditor();
    if (!editor) return false;
    try {
      editor.focus();
      strategy(editor, text);
    } catch (error) {
      console.warn(`Summarize: ${name} failed:`, error);
      continue;
    }
    if (await waitUntil(() => editorText(findEditor()).includes(marker), INSERT_CHECK_MS)) return true;
    console.warn(`Summarize: ${name} did not insert the text.`);
  }
  return false;
}

function pasteInto(editor, text) {
  if (editor instanceof HTMLTextAreaElement) return writeDirectly(editor, text);
  selectContents(editor);
  const data = new DataTransfer();
  data.setData("text/plain", text);
  editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
}

function insertWithCommand(editor, text) {
  if (editor instanceof HTMLTextAreaElement) editor.select();
  else selectContents(editor);
  document.execCommand("insertText", false, text);
}

// Writes the text as paragraphs. The editor watches its own content and picks
// up the change.
function writeDirectly(editor, text) {
  if (editor instanceof HTMLTextAreaElement) {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setValue.call(editor, text);
  } else {
    const paragraphs = text.split("\n").map((line) => {
      const p = document.createElement("p");
      if (line) p.textContent = line;
      else p.append(document.createElement("br"));
      return p;
    });
    editor.replaceChildren(...paragraphs);
    placeCaretAtEnd(editor);
  }
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function selectContents(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtEnd(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

// The first prompt field that is actually displayed.
function findEditor() {
  for (const selector of GEMINI_SELECTORS.promptInput) {
    let matches;
    try {
      matches = document.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const element of matches) {
      if (element.getClientRects().length > 0) return element;
    }
  }
  return null;
}

function editorText(editor) {
  if (!editor) return "";
  return editor instanceof HTMLTextAreaElement ? editor.value : editor.innerText ?? "";
}

// ---------------------------------------------------------------- failure

async function fail(text, reason) {
  const copied = await copyToClipboard(text);
  const next = copied
    ? "The text was copied to the clipboard. Click the prompt field and press Ctrl+V."
    : "The text could not be copied to the clipboard either. Open the extension settings to copy your instruction.";
  showBanner(`${reason} ${next}`);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall back to the older copy command.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

// A plain notice at the top of the page, isolated from Gemini styles.
function showBanner(message) {
  document.getElementById("youtube-summarizer-banner")?.remove();

  const host = document.createElement("div");
  host.id = "youtube-summarizer-banner";
  const root = host.attachShadow({ mode: "closed" });
  // Built with DOM methods: Gemini enforces Trusted Types, which blocks innerHTML.
  const style = document.createElement("style");
  style.textContent = `
    .bar {
      position: fixed; top: 8px; left: 0; right: 0; margin: 0 auto;
      z-index: 2147483647; box-sizing: border-box;
      width: min(640px, calc(100vw - 16px));
      display: flex; gap: 12px; align-items: flex-start;
      padding: 12px 16px; border: 1px solid #8a8f98; border-radius: 4px;
      background: #ffffff; color: #1f2328;
      font: 14px/1.45 "Segoe UI", system-ui, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      .bar { background: #24272b; color: #e6e8eb; border-color: #6b717a; }
    }
    p { margin: 0; flex: 1; }
    strong { font-weight: 600; }
    button {
      min-height: 32px; padding: 4px 12px; border: 1px solid currentColor;
      border-radius: 4px; background: transparent; color: inherit; font: inherit; cursor: pointer;
    }`;

  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "alert");
  const text = document.createElement("p");
  const label = document.createElement("strong");
  label.textContent = "Summarize:";
  text.append(label, ` ${message}`);
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", () => host.remove());
  bar.append(text, dismiss);

  root.append(style, bar);
  document.documentElement.append(host);
}

// ---------------------------------------------------------------- window bounds

// Firefox has no windows.onBoundsChanged event, so the popup reports its own
// size and position. Moving a window fires no page event, hence the light poll.
function trackWindowBounds() {
  let last = JSON.stringify(currentBounds());

  browser.runtime.sendMessage({ type: "checkVisible", bounds: currentBounds(), screenArea: currentScreenArea() });

  const check = () => {
    const bounds = currentBounds();
    const key = JSON.stringify(bounds);
    if (key === last) return;
    last = key;
    browser.runtime.sendMessage({ type: "saveBounds", bounds });
  };
  window.addEventListener("resize", check);
  setInterval(check, BOUNDS_POLL_MS);
}

function currentBounds() {
  return { left: window.screenX, top: window.screenY, width: window.outerWidth, height: window.outerHeight };
}

function currentScreenArea() {
  return {
    left: screen.availLeft ?? 0,
    top: screen.availTop ?? 0,
    width: screen.availWidth,
    height: screen.availHeight,
  };
}

// ---------------------------------------------------------------- helpers

function findFirst(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) return element;
    } catch {
      // Ignore selectors the browser does not support.
    }
  }
  return null;
}

// Resolves with the first truthy result of find(), or null after the timeout.
function waitFor(find, timeoutMs) {
  return new Promise((resolve) => {
    const found = find();
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const result = find();
      if (result) finish(result);
    });
    const timer = setTimeout(() => finish(null), timeoutMs);
    function finish(result) {
      observer.disconnect();
      clearTimeout(timer);
      resolve(result);
    }
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  });
}

// Resolves true as soon as check() is true, or false after the timeout.
async function waitUntil(check, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (check()) return true;
    await sleep(100);
  }
  return check();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
