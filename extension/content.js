// Message boundary only - extraction itself lives in scraping/. Loaded
// after scraping/extractStructuredData.js, scraping/extractGenericProduct.js,
// and scraping/extractProduct.js (see manifest.json's content_scripts
// order), which is what makes WishlistExtractProduct available here as
// a plain global - same convention popup.html already uses for its own
// scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.type !== "GET_PRODUCT") {
        return false;
    }

    try {
        const product = WishlistExtractProduct.extractProduct();
        const missingFields = WishlistExtractProduct.getMissingRequiredFields(product);

        if (missingFields.length > 0) {
            sendResponse({
                success: false,
                reason: "MISSING_REQUIRED_FIELDS",
                missingFields,
            });
            return true;
        }

        sendResponse({ success: true, product });
    } catch (error) {
        // Never let a raw error/stack trace reach popup.js.
        console.error("Wishlist extraction error:", error);
        sendResponse({ success: false, reason: "EXTRACTION_ERROR" });
    }

    return true;
});
