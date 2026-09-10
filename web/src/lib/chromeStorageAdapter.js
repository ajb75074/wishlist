/* global chrome */

// Detects "running as a packaged extension page", not just "running in
// Chrome" - an ordinary web page never has chrome.storage available.
// try/catch since touching `chrome` when fully undefined can throw.
export function isChromeExtensionContext() {
  try {
    return typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local;
  } catch {
    return false;
  }
}

// Supabase's async storage interface, backed by chrome.storage.local
// instead of localStorage, so a session started here is readable by
// the rest of the extension (e.g. the popup).
export const chromeStorageAdapter = {
  async getItem(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },

  async setItem(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  async removeItem(key) {
    await chrome.storage.local.remove(key);
  },
};
