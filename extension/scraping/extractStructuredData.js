// JSON-LD parsing only - no meta tags, no DOM queries, no retailer
// knowledge. Returns a predictable partial-extraction shape so the
// orchestrator (extractProduct.js) never has to know this module's
// internal JSON-LD structure.
const WishlistStructuredData = (() => {
    // Walks a parsed JSON-LD document looking for Product/ProductGroup
    // entries, including ones nested inside a top-level @graph array.
    // Safe against arbitrary nesting shapes - anything that isn't a
    // plain object/array is simply ignored rather than throwing.
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

    // Normalizes any legitimate schema.org `image` value into a single
    // usable URL string, or null - never an object, never
    // "[object Object]". Handles, in order of how this is actually
    // structured in the wild: a plain string; an array (of strings
    // and/or ImageObjects, first usable entry wins); an ImageObject
    // (preferring .url, falling back to .contentUrl); anything else
    // (missing/malformed) contributes nothing rather than being
    // stringified.
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

    // Same field-by-field logic as the original inline JSON-LD block -
    // first entry to supply a given field wins, later entries only fill
    // in whatever is still missing.
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

        // A real schema.org Product field (not a synthesized one) - only
        // used as a fallback behind the live selected-DOM color, per the
        // documented precedence.
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

        // ProductGroup variants - picks the first variant with a price,
        // same as today's behavior. This is a known limitation (not the
        // necessarily-*selected* variant) tracked as the same-URL
        // variant problem, not something this phase resolves.
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

    // Returns a predictable partial object - missing fields are always
    // null, never undefined, and raw JSON-LD structures never leak past
    // this function. productUrl is always null here: JSON-LD is never
    // used as a URL source (see extractProduct.js for why).
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
