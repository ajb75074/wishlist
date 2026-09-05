// Read-only lookup of the Supabase session the React wishlist page
// (running as this same extension) already persisted to
// chrome.storage.local via its own chromeStorageAdapter
// (web/src/lib/chromeStorageAdapter.js). Never signs in, signs out, or
// refreshes anything here - the wishlist page owns the session's whole
// lifecycle; this only reads what's already there.
const WishlistAuthSession = (() => {
    // Same idea as any token-refresh guard: don't start a new request
    // with a token that's about to expire mid-flight.
    const EXPIRY_BUFFER_SECONDS = 60;

    // Matches @supabase/supabase-js's own default storage key exactly
    // (its SupabaseClient builds `sb-${hostname.split(".")[0]}-auth-token`
    // when no custom storageKey is configured, which this project
    // doesn't set) - derived from the configured Supabase URL rather
    // than hardcoded, so this keeps working if the project URL ever
    // changes and never duplicates the project ref as its own constant.
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

    // Returns one of:
    //   { status: "valid", accessToken }
    //   { status: "expired" }
    //   { status: "signed_out" }
    // Never returns/logs the raw session, refresh_token, or full
    // access_token anywhere but the one `accessToken` field on the
    // "valid" result.
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
