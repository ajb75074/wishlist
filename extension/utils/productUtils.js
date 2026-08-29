const WishlistProductUtils = (() => {
    const trackingParameters = new Set([
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid"
    ]);

    // Clean up text before storing it
    function cleanText(value) {
        if (typeof value !== "string") {
            return null;
        }

        const cleanedValue = value.replace(/\s+/g, " ").trim();
        return cleanedValue || null;
    }

    // Convert price into a number
    function normalizePrice(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        const numberValue = Number(
            String(value).replace(/[^0-9.-]/g, "")
        );

        return Number.isFinite(numberValue) ? numberValue : null;
    }

    // Remove common tracking parameters from URLs
    function normalizeUrl(value) {
        try {
            const url = new URL(value);

            for (const parameter of [...url.searchParams.keys()]) {
                if (
                    parameter.toLowerCase().startsWith("utm_") ||
                    trackingParameters.has(parameter.toLowerCase())
                ) {
                    url.searchParams.delete(parameter);
                }
            }

            return url.toString();
        } catch (error) {
            return null;
        }
    }

    // Make sure image URLs are valid HTTP/HTTPS URLs
    function normalizeImageUrl(value) {
        const imageUrl = normalizeUrl(value);

        if (!imageUrl) {
            return null;
        }

        return imageUrl.startsWith("http://") ||
            imageUrl.startsWith("https://")
            ? imageUrl
            : null;
    }

    // Normalize a product before using it in the app
    function normalizeProduct(product) {
        return {
            id: product.id || null,
            name: cleanText(product.name),
            price: normalizePrice(product.price),
            currency: cleanText(product.currency)?.toUpperCase() || "USD",
            imageUrl: normalizeImageUrl(product.imageUrl),
            color: cleanText(product.color),
            size: cleanText(product.size),
            productUrl: normalizeUrl(product.productUrl),
            store: cleanText(product.store)?.toLowerCase() || null,
            dateSaved: product.dateSaved || null
        };
    }

    // Convert app field names into Supabase column names
    function productToDatabaseRow(product) {
        const normalizedProduct = normalizeProduct(product);

        return {
            name: normalizedProduct.name,
            price: normalizedProduct.price,
            currency: normalizedProduct.currency,
            image_url: normalizedProduct.imageUrl,
            color: normalizedProduct.color,
            size: normalizedProduct.size,
            product_url: normalizedProduct.productUrl,
            store: normalizedProduct.store
        };
    }

    return {
        normalizeProduct,
        productToDatabaseRow
    };
})();