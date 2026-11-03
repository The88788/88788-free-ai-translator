// Cache only successful translations. Text and credentials do not appear in cache keys.
// All data remains in Firefox's browser.storage.local.
export const CACHE_STORAGE_KEY = "freellmapiTranslationCacheV1";
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 200;
const CACHE_SCHEMA_VERSION = 1;

export async function cacheKey({text, source, target, endpoint, apiKey = "", model = "auto:default"}) {
  const input = JSON.stringify([CACHE_SCHEMA_VERSION, endpoint, apiKey, model, source, target, String(text).trim()]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
}

function validEntry(entry, now) {
  return entry && typeof entry.translation === "string" && !!entry.translation.trim() &&
    (entry.model == null || typeof entry.model === "string") &&
    (entry.provider == null || typeof entry.provider === "string") &&
    Number.isFinite(entry.savedAt) && now >= entry.savedAt && now - entry.savedAt < CACHE_TTL_MS;
}

function tidyCache(raw, now) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(Object.entries(source)
    .filter(([key, entry]) => /^[0-9a-f]{64}$/.test(key) && validEntry(entry, now))
    .sort((a, b) => (b[1].usedAt || b[1].savedAt) - (a[1].usedAt || a[1].savedAt))
    .slice(0, CACHE_MAX_ENTRIES));
}

export async function getCachedTranslation(storage, key, now = Date.now()) {
  try {
    const raw = (await storage.get(CACHE_STORAGE_KEY))[CACHE_STORAGE_KEY];
    const entry = raw?.[key];
    if (!validEntry(entry, now)) return null;
    // This is an LRU-ish cache; update recency on the next write instead of every read.
    return {translation: entry.translation, model: entry.model ?? null, provider: entry.provider ?? null};
  } catch {
    // Private profiles/disabled storage should never stop a translation.
    return null;
  }
}

export async function saveCachedTranslation(storage, key, result, now = Date.now()) {
  if (typeof result?.translation !== "string" || !result.translation.trim()) return false;
  try {
    const raw = (await storage.get(CACHE_STORAGE_KEY))[CACHE_STORAGE_KEY];
    const entries = tidyCache(raw, now);
    entries[key] = {
      translation: result.translation,
      model: typeof result.model === "string" ? result.model : null,
      provider: typeof result.provider === "string" ? result.provider : null,
      savedAt: now,
      usedAt: now
    };
    await storage.set({[CACHE_STORAGE_KEY]: tidyCache(entries, now)});
    return true;
  } catch {
    return false;
  }
}

export async function clearTranslationCache(storage) {
  await storage.remove(CACHE_STORAGE_KEY);
}

// Periodic housekeeping removes expired cache records from Firefox storage.
// Reading never serves expired entries even if Firefox was closed for weeks.
export async function pruneTranslationCache(storage, now = Date.now()) {
  try {
    const raw = (await storage.get(CACHE_STORAGE_KEY))[CACHE_STORAGE_KEY];
    if (!raw) return 0;
    const valid = tidyCache(raw, now);
    const removed = Object.keys(raw).length - Object.keys(valid).length;
    if (removed > 0) {
      if (Object.keys(valid).length) await storage.set({[CACHE_STORAGE_KEY]: valid});
      else await storage.remove(CACHE_STORAGE_KEY);
    }
    return removed;
  } catch { return 0; }
}
