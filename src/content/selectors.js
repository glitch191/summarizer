// All selectors for the Gemini page live in this file.
//
// Google changes the Gemini page often. When filling or sending stops
// working, open gemini.google.com, inspect the prompt field and the send
// button with the browser developer tools, and update the lists below.
//
// Each list is tried in order and the first match wins. Prefer roles, ARIA
// attributes and structural hints over visible labels, so that the selectors
// keep working whatever the interface language is. Label based selectors are
// kept last, as a final fallback only.

// eslint-disable-next-line no-unused-vars
const GEMINI_SELECTORS = {
  // The prompt field: a rich text editor (contenteditable), not a textarea.
  promptInput: [
    // Current Gemini layout: Quill editor inside a <rich-textarea> element.
    'rich-textarea [contenteditable="true"][role="textbox"]',
    'rich-textarea .ql-editor[contenteditable="true"]',
    // Any multiline ARIA text box that can be edited.
    '[contenteditable="true"][role="textbox"][aria-multiline="true"]',
    '[contenteditable="true"][role="textbox"]',
    // Older or simplified layouts.
    ".ql-editor[contenteditable='true']",
    "main textarea",
  ],

  // The button that sends the prompt. Only matched when enabled.
  sendButton: [
    // Current Gemini layout: button with the "send" Material icon.
    'button.send-button:not([disabled]):not([aria-disabled="true"])',
    'button:has(mat-icon[fonticon="send"]):not([disabled]):not([aria-disabled="true"])',
    'button:has(mat-icon[data-mat-icon-name="send"]):not([disabled]):not([aria-disabled="true"])',
    // Label based fallback (English interface only).
    'button[aria-label^="Send" i]:not([disabled]):not([aria-disabled="true"])',
  ],

  // Signs that the Google account is not signed in on the Gemini page.
  signInLink: [
    'a[href*="accounts.google.com/ServiceLogin"]',
    'a[href*="accounts.google.com/v3/signin"]',
    'a[href*="accounts.google.com"][href*="signin" i]',
  ],
};
