/* global chrome */

// Detects "running as a packaged extension page" (chrome-extension://...),
// not just "running in Chrome the browser" - an ordinary web page (even
// in Chrome, even on localhost during `npm run dev`) never has
// chrome.storage available, only pages loaded from the extension itself
// do (this page's own manifest.json already grants the "storage"
// permission). Wrapped in try/catch since touching `chrome` at all in a
// context where it's fully undefined (not just partially) could throw
// depending on how strict the environment is.
export function isChromeExtensionContext() {
  try {
    return typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local;
  } catch {
    return false;
  }
}

// Supabase's expected async storage interface (getItem/setItem/removeItem),
// backed by chrome.storage.local instead of window.localStorage - so a
// session started on this same page, when it's running inside the
// extension, is readable by the rest of the extension (e.g. the popup)
// later. MV3's chrome.storage.local already returns Promises when no
// callback is passed, so no manual callback-wrapping is needed here.
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
