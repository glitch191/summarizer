import { buildRequest } from "./prompt.js";
import { normalizeYouTubeUrl } from "./youtube-url.js";

const GEMINI_URL = "https://gemini.google.com/app";
// Key of the pending task for Gemini in the sidebar, which is not a tab.
const SIDEBAR_TASK = "sidebar";

// Menu ids carry the display mode ("summarize-page:sidebar"), because the
// sidebar can only be opened synchronously inside the click handler, before
// any stored setting could be read.
const MENU_PAGE = "summarize-page";
const MENU_LINK = "summarize-link";

// Summarize appears on every web page and on every link to a web page.
const WEB_PATTERNS = ["http://*/*", "https://*/*"];

const DEFAULT_SETTINGS = { openIn: "sidebar", sendAutomatically: true, reuseWindow: true };
const DEFAULT_SIZE = { width: 720, height: 900 };
const MIN_SIZE = { width: 400, height: 300 };
// How much of the window must overlap the screen to count as visible.
const MIN_VISIBLE = 100;

// Session data (survives the background page being unloaded, not a restart):
//   popupWindowIds: ids of popup windows opened by the extension, newest last
//   pendingTasks: { [tabId or "sidebar"]: { text, attachment?, fallbackText?, sendAutomatically } }

async function createMenus() {
  const { openIn } = await browser.storage.local.get({ openIn: DEFAULT_SETTINGS.openIn });
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: `${MENU_PAGE}:${openIn}`,
    title: "Summarize",
    contexts: ["page", "video"],
    documentUrlPatterns: WEB_PATTERNS,
  });
  browser.contextMenus.create({
    id: `${MENU_LINK}:${openIn}`,
    title: "Summarize",
    contexts: ["link"],
    targetUrlPatterns: WEB_PATTERNS,
  });
}

browser.runtime.onInstalled.addListener(createMenus);
browser.runtime.onStartup.addListener(createMenus);
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "openIn" in changes) createMenus();
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  const [menu, openIn] = String(info.menuItemId).split(":");
  // Must run before anything asynchronous: Firefox only lets an extension
  // open its sidebar while handling a user action.
  if (openIn === "sidebar") browser.sidebarAction.open();

  const source = menu === MENU_LINK ? info.linkUrl : info.pageUrl || tab?.url;
  // Page text can only be read from the page itself, not from a link target.
  const tabId = menu === MENU_PAGE ? tab?.id : undefined;
  summarize(source, openIn, tab?.windowId, tabId).catch((error) => console.error("Summarize failed:", error));
});

// Instructions saved in the settings, or the defaults shipped with the extension.
const INSTRUCTIONS = {
  instruction: "default-instruction.txt",
  pageInstruction: "default-page-instruction.txt",
};

async function getInstruction(key) {
  const stored = (await browser.storage.local.get(key))[key];
  if (typeof stored === "string") return stored;
  const response = await fetch(browser.runtime.getURL(INSTRUCTIONS[key]));
  return (await response.text()).trim();
}

// Reads the title and visible text of the page in the given tab. The click on
// the menu entry grants temporary access to that tab (activeTab). Returns null
// when the page cannot be read (for example a Firefox page or a PDF).
async function readPage(tabId) {
  if (tabId === undefined) return null;
  try {
    const [result] = await browser.scripting.executeScript({ target: { tabId }, func: extractPageText });
    return result?.result ?? null;
  } catch (error) {
    console.warn("Summarize: could not read the page:", error);
    return null;
  }
}

// Runs inside the page. Prefers the main article over menus and footers.
function extractPageText() {
  if (!document.body) return { title: document.title, text: "" };
  const main = [document.querySelector("article"), document.querySelector("main, [role='main']")].find(
    (element) => element && element.innerText.trim().length > 500,
  );
  return { title: document.title, text: (main ?? document.body).innerText };
}

async function summarize(source, openIn, windowId, sourceTabId) {
  const stored = await browser.storage.local.get(DEFAULT_SETTINGS);
  const isVideo = normalizeYouTubeUrl(source) !== null;
  const request = buildRequest({
    address: source,
    videoInstruction: await getInstruction("instruction"),
    pageInstruction: await getInstruction("pageInstruction"),
    page: isVideo ? null : await readPage(sourceTabId),
  });
  if (!request) {
    console.warn("Summarize: not a web page address:", source);
    return;
  }
  const task = { ...request, sendAutomatically: stored.sendAutomatically };

  if (openIn === "sidebar") {
    // Store the task before Gemini loads so the content script always finds it.
    await setPendingTask(SIDEBAR_TASK, task);
    // A new address each time makes the sidebar load a new conversation.
    const panel = `${GEMINI_URL}?ys=${Date.now()}`;
    await browser.sidebarAction.setPanel(windowId === undefined ? { panel } : { windowId, panel });
    return;
  }

  const tabId = await openPopupTab(stored.reuseWindow);
  await setPendingTask(tabId, task);
  await browser.tabs.update(tabId, { url: GEMINI_URL });
}

// Returns the id of a tab in a popup window, ready to be navigated to Gemini.
async function openPopupTab(reuseWindow) {
  if (reuseWindow) {
    const existing = await findExistingPopup();
    if (existing) {
      await browser.windows.update(existing.id, { focused: true });
      return existing.tabs[0].id;
    }
  }

  const bounds = await getStartBounds();
  const created = await browser.windows.create({
    type: "popup",
    url: "about:blank",
    ...bounds,
  });
  // Firefox may ignore the position given at creation, so apply it again.
  await browser.windows.update(created.id, bounds).catch(() => {});

  const { popupWindowIds = [] } = await browser.storage.session.get("popupWindowIds");
  await browser.storage.session.set({ popupWindowIds: [...popupWindowIds, created.id] });
  return created.tabs[0].id;
}

async function findExistingPopup() {
  const { popupWindowIds = [] } = await browser.storage.session.get("popupWindowIds");
  for (const id of [...popupWindowIds].reverse()) {
    try {
      const win = await browser.windows.get(id, { populate: true });
      if (win.tabs?.length) return win;
    } catch {
      // The window was closed while the background page was unloaded.
    }
  }
  return null;
}

// Saved bounds if any, otherwise a default size centered on the primary screen.
async function getStartBounds() {
  const { windowBounds } = await browser.storage.local.get("windowBounds");
  if (isValidBounds(windowBounds)) return windowBounds;
  return centeredBounds();
}

function centeredBounds() {
  const area = primaryScreenArea();
  const width = Math.min(DEFAULT_SIZE.width, area.width);
  const height = Math.min(DEFAULT_SIZE.height, area.height);
  return {
    width,
    height,
    left: Math.round(area.left + (area.width - width) / 2),
    top: Math.round(area.top + (area.height - height) / 2),
  };
}

function primaryScreenArea() {
  // The background page lives on the primary screen.
  return {
    left: screen.availLeft ?? 0,
    top: screen.availTop ?? 0,
    width: screen.availWidth,
    height: screen.availHeight,
  };
}

function isValidBounds(b) {
  return (
    b &&
    [b.left, b.top, b.width, b.height].every(Number.isFinite) &&
    b.width >= MIN_SIZE.width &&
    b.height >= MIN_SIZE.height
  );
}

// True when enough of the window overlaps the screen area it reports.
function isVisibleOn(bounds, area) {
  const overlapX = Math.min(bounds.left + bounds.width, area.left + area.width) - Math.max(bounds.left, area.left);
  const overlapY = Math.min(bounds.top + bounds.height, area.top + area.height) - Math.max(bounds.top, area.top);
  return overlapX >= MIN_VISIBLE && overlapY >= MIN_VISIBLE;
}

async function setPendingTask(tabId, task) {
  const { pendingTasks = {} } = await browser.storage.session.get("pendingTasks");
  pendingTasks[tabId] = task;
  await browser.storage.session.set({ pendingTasks });
}

async function takePendingTask(tabId) {
  const { pendingTasks = {} } = await browser.storage.session.get("pendingTasks");
  const task = pendingTasks[tabId] ?? null;
  if (task) {
    delete pendingTasks[tabId];
    await browser.storage.session.set({ pendingTasks });
  }
  return task;
}

async function isPopupWindow(windowId) {
  const { popupWindowIds = [] } = await browser.storage.session.get("popupWindowIds");
  return popupWindowIds.includes(windowId);
}

async function saveBounds(windowId, bounds) {
  if (!(await isPopupWindow(windowId)) || !isValidBounds(bounds)) return;
  await browser.storage.local.set({ windowBounds: bounds });
}

// Messages from the content script running in Gemini tabs.
browser.runtime.onMessage.addListener((message, sender) => {
  const tab = sender.tab;
  if (!tab || tab.id === browser.tabs.TAB_ID_NONE) {
    // Gemini in the sidebar: it is not a tab and has no window to track.
    if (message?.type === "getTask") {
      return takePendingTask(SIDEBAR_TASK).then((task) => ({ task, isPopup: false }));
    }
    return undefined;
  }

  switch (message?.type) {
    case "getTask":
      return (async () => ({
        task: await takePendingTask(tab.id),
        isPopup: await isPopupWindow(tab.windowId),
      }))();

    case "saveBounds":
      return saveBounds(tab.windowId, message.bounds);

    case "checkVisible":
      // The content script reports the screen area its window is on. If the
      // window is mostly off that screen (for example after a monitor was
      // removed), move it back to the primary screen.
      return (async () => {
        if (!(await isPopupWindow(tab.windowId))) return;
        if (isVisibleOn(message.bounds, message.screenArea)) return;
        const bounds = centeredBounds();
        await browser.windows.update(tab.windowId, bounds);
        await browser.storage.local.set({ windowBounds: bounds });
      })();

    default:
      return undefined;
  }
});

browser.windows.onRemoved.addListener(async (windowId) => {
  const { popupWindowIds = [] } = await browser.storage.session.get("popupWindowIds");
  if (popupWindowIds.includes(windowId)) {
    await browser.storage.session.set({ popupWindowIds: popupWindowIds.filter((id) => id !== windowId) });
  }
});

// Firefox does not implement windows.onBoundsChanged at the time of writing.
// Use it when available; otherwise the content script reports size and
// position changes of the popup.
// Accessed by name so the linter does not flag an API Firefox lacks.
const onBoundsChanged = browser.windows["onBoundsChanged"];
if (onBoundsChanged) {
  onBoundsChanged.addListener((win) => {
    saveBounds(win.id, { left: win.left, top: win.top, width: win.width, height: win.height });
  });
}
