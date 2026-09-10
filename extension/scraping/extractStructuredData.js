// JSON-LD parsing only - no meta tags, no DOM queries, no retailer knowledge.
const WishlistStructuredData = (() => {
    // Collects Product/ProductGroup entries at any depth, including inside
    // @graph. Anything malformed is ignored rather than thrown.
    function collectProductLikeEntries(data, acc) {
        if (!data || typeof data !== "object") {
            return;
        }

        if (Array.isArray(data)) {
            for (const entry of data) {
                collectProductLikeEntries(entry, acc);
            }
            return;
        }

        if (Array.isArray(data["@graph"])) {
            for (const entry of data["@graph"]) {
                collectProductLikeEntries(entry, acc);
            }
        }

        if (data["@type"] === "Product" || data["@type"] === "ProductGroup") {
            acc.push(data);
        }
    }

    // schema.org image can be a string, an array, or an ImageObject -
    // normalize all of them to one URL, or null.
    function extractImageUrl(image) {
        if (!image) {
            return null;
        }

        if (typeof image === "string") {
            return image;
        }

        if (Array.isArray(image)) {
            for (const entry of image) {
                const url = extractImageUrl(entry);
                if (url) {
                    return url;
                }
            }
            return null;
        }

        if (typeof image === "object") {
            if (typeof image.url === "string") {
                return image.url;
            }
            if (typeof image.contentUrl === "string") {
                return image.contentUrl;
            }
        }

        return null;
    }

    function applyEntry(entry, result) {
        if (!result.name && entry.name) {
            result.name = entry.name;
        }

        if (!result.imageUrl) {
            const imageUrl = extractImageUrl(entry.image);
            if (imageUrl) {
                result.imageUrl = imageUrl;
            }
        }

        if (!result.color && typeof entry.color === "string") {
            result.color = entry.color;
        }

        if (entry.offers) {
            const offers = Array.isArray(entry.offers)
                ? entry.offers[0]
                : entry.offers;

            if (offers?.price) {
                result.price = offers.price;
            }

            if (offers?.priceCurrency) {
                result.currency = offers.priceCurrency;
            }
        }

        // Picks the first variant with a price - not necessarily the selected
        // one (known limitation).
        if (!result.price && Array.isArray(entry.hasVariant)) {
            const variant = entry.hasVariant.find((v) => v.offers?.price);

            if (variant) {
                result.price = variant.offers.price;

                if (variant.offers.priceCurrency) {
                    result.currency = variant.offers.priceCurrency;
                }
            }
        }
    }

    function extractStructuredProduct(doc = document) {
        const result = {
            name: null,
            price: null,
            currency: null,
            imageUrl: null,
            color: null,
            productUrl: null,
        };

        const scripts = doc.querySelectorAll(
            'script[type="application/ld+json"]'
        );

        for (const script of scripts) {
            let parsed;

            try {
                parsed = JSON.parse(script.textContent);
            } catch {
                // One malformed JSON-LD script must not block the others.
                continue;
            }

            const entries = [];
            collectProductLikeEntries(parsed, entries);

            for (const entry of entries) {
                applyEntry(entry, result);
            }
        }

        return result;
    }

    return {
        extractStructuredProduct,
    };
})();
