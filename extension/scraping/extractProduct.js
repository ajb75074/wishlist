// Orchestration only - merges the structured/meta/DOM results by per-field
// precedence.
const WishlistExtractProduct = (() => {
    const REQUIRED_FIELDS = ["name", "imageUrl", "productUrl", "store"];

    function firstNonNull(...values) {
        for (const value of values) {
            if (value !== null && value !== undefined && value !== "") {
                return value;
            }
        }
        return null;
    }

    function extractProduct(doc = document, currentLocation = window.location) {
        const structured = WishlistStructuredData.extractStructuredProduct(doc);
        const meta = WishlistGenericProduct.extractMetaProduct(doc);
        const dom = WishlistGenericProduct.extractDomProduct(doc);

        const selectedColor = WishlistGenericProduct.extractSelectedColor(doc);

        return {
            // NAME: structured -> meta -> DOM. Name rarely changes by
            // variant, so JSON-LD's stability is a feature here.
            name: firstNonNull(structured.name, meta.name, dom.name),

            // PRICE/IMAGE: a confident DOM reading wins first, since these go
            // stale when JSON-LD describes the base product rather than the
            // selected variant.
            price: firstNonNull(dom.price, structured.price, meta.price),
            currency: firstNonNull(structured.currency, meta.currency) || "USD",
            imageUrl: firstNonNull(dom.imageUrl, structured.imageUrl, meta.imageUrl),

            // COLOR: live selected-DOM state first: JSON-LD/meta almost
            // never encode the *currently selected* variant, only the
            // base product or its available options.
            color: firstNonNull(selectedColor, structured.color),

            // Canonical URL, falling back to location.href - never
            // synthesized. Same-URL variants remain a known limitation.
            productUrl: WishlistGenericProduct.extractCanonicalUrl(doc, currentLocation),

            // Unchanged: hostname, not a scraped brand name.
            store: WishlistGenericProduct.extractStore(currentLocation),
        };
    }

    function getMissingRequiredFields(product) {
        return REQUIRED_FIELDS.filter((field) => !product[field]);
    }

    return {
        extractProduct,
        getMissingRequiredFields,
        REQUIRED_FIELDS,
    };
})();
