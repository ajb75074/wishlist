const WishlistProductUtils = (() => {
    const trackingParameters = new Set([
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid"
    ]);

    function cleanText(value) {
        if (typeof value !== "string") {
            return null;
        }

        const cleanedValue = value.replace(/\s+/g, " ").trim();
        return cleanedValue || null;
    }

    function normalizePrice(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        const numberValue = Number(
            String(value).replace(/[^0-9.-]/g, "")
        );

        return Number.isFinite(numberValue) ? numberValue : null;
    }

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

    function normalizeImageUrl(value) {
        const imageUrl = normalizeUrl(value);

        if (!imageUrl) {
            return null;
        }

        return imageUrl.startsWith("http://") || imageUrl.startsWith("https://")
            ? imageUrl
            : null;
    }

    function normalizeProduct(product) {
        return {
            id: product.id || null,
            name: cleanText(product.name),
            price: normalizePrice(product.price),
            currency: cleanText(product.currency)?.toUpperCase() || "USD",
            imageUrl: normalizeImageUrl(product.imageUrl),
            color: cleanText(product.color),
            productUrl: normalizeUrl(product.productUrl),
            store: cleanText(product.store)?.toLowerCase() || null,
            dateSaved: product.dateSaved || null
        };
    }

    function productToDatabaseRow(product) {
        const normalizedProduct = normalizeProduct(product);

        return {
            name: normalizedProduct.name,
            price: normalizedProduct.price,
            currency: normalizedProduct.currency,
            image_url: normalizedProduct.imageUrl,
            color: normalizedProduct.color,
            product_url: normalizedProduct.productUrl,
            store: normalizedProduct.store
        };
    }

    return {
        normalizeProduct,
        productToDatabaseRow
    };
})();
