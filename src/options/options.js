// Settings page. Every change is saved immediately to storage.local.

const DEFAULT_SETTINGS = { openIn: "sidebar", sendAutomatically: true, reuseWindow: true };
const SAVE_DELAY_MS = 300;

// Instruction fields: storage key, text field and default file.
const INSTRUCTIONS = [
  { key: "instruction", field: document.getElementById("instruction"), file: "default-instruction.txt" },
  { key: "pageInstruction", field: document.getElementById("page-instruction"), file: "default-page-instruction.txt" },
];

const sendSwitch = document.getElementById("send-automatically");
const reuseSwitch = document.getElementById("reuse-window");
const statusLine = document.getElementById("status");
const openInChoices = document.querySelectorAll('input[name="open-in"]');

let statusTimer = null;

async function loadDefault(file) {
  const response = await fetch(browser.runtime.getURL(file));
  return (await response.text()).trim();
}

function showStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle("error", isError);
  clearTimeout(statusTimer);
  if (!isError) statusTimer = setTimeout(() => (statusLine.textContent = ""), 4000);
}

async function save(values, message = "Saved") {
  try {
    await browser.storage.local.set(values);
    showStatus(message);
  } catch (error) {
    showStatus(`Could not save the setting: ${error.message}. Reload the page and try again.`, true);
  }
}

async function setUpInstruction({ key, field, file }, stored) {
  const defaultText = await loadDefault(file);
  field.value = typeof stored[key] === "string" ? stored[key] : defaultText;

  let saveTimer = null;
  field.addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save({ [key]: field.value }), SAVE_DELAY_MS);
  });

  document.querySelector(`button[data-key="${key}"]`).addEventListener("click", async () => {
    clearTimeout(saveTimer);
    field.value = defaultText;
    try {
      await browser.storage.local.remove(key);
      showStatus("Instruction reset to default");
    } catch (error) {
      showStatus(`Could not reset the instruction: ${error.message}`, true);
    }
  });
}

async function init() {
  document.getElementById("version").textContent = browser.runtime.getManifest().version;

  const stored = await browser.storage.local.get({ ...DEFAULT_SETTINGS, instruction: null, pageInstruction: null });
  await Promise.all(INSTRUCTIONS.map((instruction) => setUpInstruction(instruction, stored)));

  sendSwitch.checked = stored.sendAutomatically;
  reuseSwitch.checked = stored.reuseWindow;
  for (const choice of openInChoices) choice.checked = choice.value === stored.openIn;
  // Apply the saved states without animation, then allow transitions.
  void document.body.offsetWidth;
  document.body.classList.add("ready");

  sendSwitch.addEventListener("change", () => save({ sendAutomatically: sendSwitch.checked }));
  reuseSwitch.addEventListener("change", () => save({ reuseWindow: reuseSwitch.checked }));
  for (const choice of openInChoices) {
    choice.addEventListener("change", () => save({ openIn: choice.value }));
  }

  document.getElementById("reset-window").addEventListener("click", async () => {
    try {
      await browser.storage.local.remove("windowBounds");
      showStatus("Window size and position reset. The next popup opens at the default size.");
    } catch (error) {
      showStatus(`Could not reset the window: ${error.message}`, true);
    }
  });
}

init().catch((error) => showStatus(`Could not load the settings: ${error.message}`, true));
