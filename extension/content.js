function extractProduct() {
    let name = null;
    let price = null;
    let currency = "USD";
    let imageUrl = null;
    let color = null;

    // Get the current product URL
    const productUrl = window.location.href;

    // Get the store name
    const store = window.location.hostname.replace(/^www\./, "");

    // ------------------------------------------------
    // 1. Try JSON-LD structured product data first
    // ------------------------------------------------

    const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
    );

    for (const script of scripts) {
        try {
            const data = JSON.parse(script.textContent);

            const products = Array.isArray(data) ? data : [data];

            for (const item of products) {

                if (
                    item["@type"] === "Product" ||
                    item["@type"] === "ProductGroup"
                ) {
                    // Product name
                    if (!name && item.name) {
                        name = item.name;
                    }

                    // Product image
                    if (!imageUrl && item.image) {
                        imageUrl = Array.isArray(item.image)
                            ? item.image[0]
                            : item.image;
                    }

                    // Brand/store
                    // Keep the website hostname as the store
                    // so it works consistently across websites.

                    // Price
                    if (item.offers) {

                        const offers = Array.isArray(item.offers)
                            ? item.offers[0]
                            : item.offers;

                        if (offers.price) {
                            price = offers.price;
                        }

                        if (offers.priceCurrency) {
                            currency = offers.priceCurrency;
                        }
                    }

                    // ProductGroup variants
                    if (
                        !price &&
                        item.hasVariant &&
                        Array.isArray(item.hasVariant)
                    ) {
                        const variant = item.hasVariant.find(
                            v => v.offers?.price
                        );

                        if (variant) {
                            price = variant.offers.price;

                            if (variant.offers.priceCurrency) {
                                currency = variant.offers.priceCurrency;
                            }
                        }
                    }
                }

            }

        } catch (error) {
            // Skip invalid JSON-LD
        }
    }

    // ------------------------------------------------
    // 2. Standard metadata fallbacks
    // ------------------------------------------------

    if (!name) {
        name =
            document.querySelector('meta[property="og:title"]')?.content ||
            document.querySelector('meta[name="twitter:title"]')?.content;
    }

    if (!imageUrl) {
        imageUrl =
            document.querySelector('meta[property="og:image"]')?.content ||
            document.querySelector('meta[name="twitter:image"]')?.content;
    }

    if (!price) {
        price =
            document.querySelector('meta[property="product:price:amount"]')
                ?.content ||
            document.querySelector('meta[property="og:price:amount"]')
                ?.content;
    }

    if (
        document.querySelector('meta[property="product:price:currency"]')
    ) {
        currency =
            document.querySelector(
                'meta[property="product:price:currency"]'
            ).content;
    }

    // ------------------------------------------------
    // 3. Look for the currently selected color
    // ------------------------------------------------

    const colorSelectors = [
        '[data-testid="swatch-color-title"]',
        '[data-testid="selected-color"]',
        '[aria-selected="true"][data-color]',
        '[aria-checked="true"][data-color]',
        '#variation_color_name .selection',
        '#variation_color_name span'
    ];

    for (const selector of colorSelectors) {
        const element = document.querySelector(selector);

        if (element?.textContent.trim()) {
            color = element.textContent.trim();
            break;
        }
    }

    // ------------------------------------------------
    // 4. Product-page DOM fallbacks
    // ------------------------------------------------

    if (!name) {
        name =
            document.querySelector("#productTitle")?.textContent.trim() ||
            document.querySelector('[itemprop="name"]')?.textContent.trim() ||
            document.querySelector("h1")?.textContent.trim();
    }

    // Amazon/product-page image fallback
    if (!imageUrl) {

        const imageElement =
            document.querySelector("#landingImage") ||
            document.querySelector("#imgTagWrapperId img") ||
            document.querySelector('[itemprop="image"]');

        if (imageElement) {
            imageUrl =
                imageElement.getAttribute("data-old-hires") ||
                imageElement.getAttribute("data-a-dynamic-image")
                    ? Object.keys(
                        JSON.parse(
                            imageElement.getAttribute("data-a-dynamic-image") ||
                            "{}"
                        )
                    )[0]
                    : imageElement.src;
        }
    }

    // ------------------------------------------------
    // 5. Price fallback
    // ------------------------------------------------

    if (!price) {
        const priceElement =
            document.querySelector("#corePriceDisplay_desktop_feature_div .a-offscreen") ||
            document.querySelector("#corePrice_feature_div .a-offscreen") ||
            document.querySelector(".a-price .a-offscreen") ||
            document.querySelector('[itemprop="price"]');

        if (priceElement) {
            price = priceElement.textContent
                .replace(/[^0-9.]/g, "")
                .trim();
        }
    }

    // ------------------------------------------------
    // 6. Clean up the data
    // ------------------------------------------------

    if (name) {
        name = name.replace(/\s+/g, " ").trim();
    }

    if (store) {
        // Keep hostname normalized
        // Example: www.amazon.com -> amazon.com
    }

    return {
        name: name || null,
        price: price || null,
        currency: currency || "USD",
        imageUrl: imageUrl || null,
        color: color || null,
        productUrl,
        store
    };
}


// Listen for requests from the extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === "extractProduct") {
        sendResponse(extractProduct());
    }

    return true;
});