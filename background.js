import {pruneTranslationCache} from "./lib/cache.mjs";
"use strict";
const selections = new Map();
const MAX_AGE_MS = 30 * 60 * 1000;
function remember(tabId, text) {
  if (typeof tabId !== "number" || typeof text !== "string" || !text.trim()) return;
  selections.set(tabId, { text: text.slice(0, 20000), at: Date.now() });
}
browser.menus.create({
  id: "freellmapi-translate-selection",
  title: browser.i18n.getMessage("translateSelection") || "Translate selection with 88788 Free AI Translator",
  contexts: ["selection"]
});
browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "freellmapi-translate-selection") return;
  remember(tab?.id, info.selectionText || "");
  browser.sidebarAction.open().catch(() => {});
});
browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "selectionChanged") {
    remember(sender.tab?.id, message.text);
    return undefined;
  }
  if (message?.type === "getCachedSelection") {
    const selected = selections.get(message.tabId);
    return Promise.resolve(selected && Date.now() - selected.at < MAX_AGE_MS ? selected.text : "");
  }
  return undefined;
});
browser.tabs.onRemoved.addListener(tabId => selections.delete(tabId));
browser.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "loading") selections.delete(tabId);
});

// Alarms do not survive Firefox restarts, so recreate the daily cleanup alarm
// every time the background script wakes up. No network calls are made.
const CACHE_CLEANUP_ALARM = "88788-translation-cache-cleanup";
void browser.alarms.create(CACHE_CLEANUP_ALARM, {periodInMinutes:1440});
void pruneTranslationCache(browser.storage.local);
browser.alarms.onAlarm.addListener((alarm)=>{
  if (alarm.name===CACHE_CLEANUP_ALARM) void pruneTranslationCache(browser.storage.local);
});
