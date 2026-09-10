// Read-only lookup of the session the React page already persisted to
// chrome.storage.local.
const WishlistAuthSession = (() => {
    // Same idea as any token-refresh guard: don't start a new request
    // with a token that's about to expire mid-flight.
    const EXPIRY_BUFFER_SECONDS = 60;

    // Matches supabase-js's default storage key: sb-<hostname first
    // label>-auth-token.
    function deriveStorageKey(supabaseUrl) {
        const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
        return `sb-${projectRef}-auth-token`;
    }

    function isUsableSessionShape(value) {
        return (
            value &&
            typeof value === "object" &&
            typeof value.access_token === "string" &&
            value.access_token.length > 0 &&
            typeof value.expires_at === "number"
        );
    }

    // Returns { status: "valid", accessToken } | { status: "expired" } | {
    // status: "signed_out" }. Never logs the raw session or refresh token.
    async function getStoredSession(supabaseUrl) {
        const key = deriveStorageKey(supabaseUrl);
        const result = await chrome.storage.local.get(key);
        const raw = result[key];

        if (!raw) {
            return { status: "signed_out" };
        }

        let session;
        try {
            // supabase-js always writes via JSON.stringify, so this is
            // normally a string - the typeof guard is just a safety net,
            // not an expected path.
            session = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
            return { status: "signed_out" };
        }

        if (!isUsableSessionShape(session)) {
            return { status: "signed_out" };
        }

        const nowSeconds = Date.now() / 1000;
        if (session.expires_at - EXPIRY_BUFFER_SECONDS <= nowSeconds) {
            return { status: "expired" };
        }

        return { status: "valid", accessToken: session.access_token };
    }

    return {
        getStoredSession
    };
})();
