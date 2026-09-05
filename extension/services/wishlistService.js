const WishlistService = (() => {
    function getConfig() {
        const config = globalThis.WishlistExtensionConfig;

        if (
            !config?.supabaseUrl ||
            !config?.supabasePublishableKey ||
            !config?.wishlistTable
        ) {
            throw new Error("Supabase extension configuration is missing.");
        }

        return config;
    }

    async function saveToLocalStorage(product) {
        const result = await chrome.storage.local.get("wishlist");
        const wishlist = result.wishlist || [];

        await chrome.storage.local.set({
            wishlist: [...wishlist, product]
        });
    }

    async function saveWishlistItem(product) {
        const normalizedProduct = WishlistProductUtils.normalizeProduct(product);

        if (
            !normalizedProduct.name ||
            !normalizedProduct.imageUrl ||
            !normalizedProduct.productUrl ||
            !normalizedProduct.store
        ) {
            return { success: false, validationError: true };
        }

        const config = getConfig();

        // wishitems.user_id is NOT NULL with a DEFAULT of auth.uid() -
        // there's no user-owned write this can make without a real
        // session, so this is checked and returned on *before* any
        // network call, not just handled after a failed request.
        const sessionResult = await WishlistAuthSession.getStoredSession(config.supabaseUrl);

        if (sessionResult.status !== "valid") {
            return { success: false, authRequired: true, sessionStatus: sessionResult.status };
        }

        try {
            const response = await fetch(
                `${config.supabaseUrl}/rest/v1/${config.wishlistTable}`,
                {
                    method: "POST",
                    headers: {
                        apikey: config.supabasePublishableKey,
                        Authorization: `Bearer ${sessionResult.accessToken}`,
                        "Content-Type": "application/json",
                        Prefer: "return=representation"
                    },
                    body: JSON.stringify(
                        WishlistProductUtils.productToDatabaseRow(product)
                    )
                }
            );

            if (response.status === 401 || response.status === 403) {
                // The session looked valid locally but Supabase rejected
                // it anyway (revoked/rotated elsewhere, clock skew,
                // etc.) - never retry with the anon/publishable key for
                // a user-owned write, and never let this fall into the
                // catch block below, which would otherwise disguise an
                // auth failure as a "saved locally, Supabase
                // unavailable" success-flavored message.
                return { success: false, authRequired: true, sessionStatus: "rejected" };
            }

            const responseBody = await response.json().catch(() => null);

            if (!response.ok) {
                if (responseBody?.code === "23505") {
                    return { success: false, duplicate: true };
                }

                throw new Error(
                    responseBody?.message || "Unable to save the item."
                );
            }

            try {
                await saveToLocalStorage(normalizedProduct);
            } catch (storageError) {
                console.error("Local storage mirror failed:", storageError);
            }

            return { success: true, product: responseBody?.[0] || null };
        } catch (error) {
            // Reaching here means a genuine network/fetch-level failure
            // or an unexpected non-auth server error - not an
            // authorization problem, which is already returned above
            // before this try block is ever entered.
            console.error("Supabase save error:", error);

            try {
                await saveToLocalStorage(normalizedProduct);
                return { success: false, savedLocally: true };
            } catch (storageError) {
                console.error("Local save error:", storageError);
                return { success: false, savedLocally: false };
            }
        }
    }

    return {
        saveWishlistItem
    };
})();
