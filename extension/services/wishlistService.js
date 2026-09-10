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

        // wishitems.user_id is NOT NULL defaulting to auth.uid(), so a
        // session is required before any network call is made.
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
                // The session looked valid locally but Supabase rejected it -
                // never retry a user-owned write with the anon key.
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
            // A genuine network or server failure, not an authorization
            // problem (those return above).
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
