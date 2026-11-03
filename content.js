"use strict";

let previousText = "";
let debounce;

function getSelectedText() {
  const focused = document.activeElement;
  if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
    if (focused instanceof HTMLInputElement && (focused.type === "password" || focused.type === "hidden")) return "";
    if (typeof focused.selectionStart === "number" && typeof focused.selectionEnd === "number") {
      const selected = focused.value.slice(focused.selectionStart, focused.selectionEnd).trim();
      if (selected) return selected;
    }
  }
  return String(window.getSelection?.() ?? "").trim();
}

function notifySelection() {
  const text = getSelectedText();
  if (!text || text === previousText) return;
  previousText = text;
  // No HTTP requests are performed by this content script.
  browser.runtime.sendMessage({ type: "selectionChanged", text }).catch(() => {});
}

document.addEventListener("selectionchange", () => {
  clearTimeout(debounce);
  debounce = setTimeout(notifySelection, 130);
});
document.addEventListener("mouseup", notifySelection);
document.addEventListener("keyup", notifySelection);

browser.runtime.onMessage.addListener(message => {
  if (message?.type === "getSelection") return Promise.resolve({ text: getSelectedText() || previousText });
  return undefined;
});
