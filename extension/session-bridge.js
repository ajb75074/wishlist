// Runs only on our own deployed app (see manifest.json matches). The popup
// can only read chrome.storage.local, but signing in on the live site
// writes the session to this page's own localStorage instead - so this
// mirrors it across, in both directions (sign-in and sign-out).
(function () {
    const config = globalThis.WishlistExtensionConfig;
    if (!config?.supabaseUrl) return;

    function deriveStorageKey(supabaseUrl) {
        const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
        return `sb-${projectRef}-auth-token`;
    }

    const key = deriveStorageKey(config.supabaseUrl);

    function sync() {
        const value = window.localStorage.getItem(key);
        if (value) {
            chrome.storage.local.set({ [key]: value });
        } else {
            chrome.storage.local.remove(key);
        }
    }

    sync();
    window.addEventListener("storage", (event) => {
        if (event.key === key) sync();
    });
    setInterval(sync, 5000);
})();
