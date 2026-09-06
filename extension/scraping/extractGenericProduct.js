// Meta-tag + DOM extraction, organized by concern. No JSON-LD here
// (see extractStructuredData.js) and no orchestration/precedence logic
// (see extractProduct.js) - this module only knows how to read values
// off the live page.
const WishlistGenericProduct = (() => {
    // Unchanged from the original inline scraper - six selectors, first
    // non-empty textContent wins. Not expanded in this phase; live
    // testing on Mihara found no reliable generic color signal, so this
    // stays exactly as-is (Part 7).
    const COLOR_SELECTORS = [
        '[data-testid="swatch-color-title"]',
        '[data-testid="selected-color"]',
        '[aria-selected="true"][data-color]',
        '[aria-checked="true"][data-color]',
        "#variation_color_name .selection",
        "#variation_color_name span",
    ];

    // A leaf element's cleaned text has to be *only* a currency amount
    // to match - "$315.00" matches, "$315.00 (was $420.00)" does not,
    // a star rating or review count does not (no currency symbol).
    const PRICE_TEXT_PATTERN = /^[$€£¥]\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?$/;

    // How far up from the product name/title element to look for a
    // nearby bare price - bounds the search to the product-info panel
    // instead of the whole page.
    const PRICE_SEARCH_ANCESTOR_LEVELS = 4;

    // A visible <img> has to be at least this large (in each dimension)
    // to be considered a plausible main product image - well above the
    // size of a typical icon, logo, or small thumbnail.
    const MIN_LIKELY_PRODUCT_IMAGE_DIMENSION = 300;

    function cleanNonEmpty(rawText) {
        const cleaned = WishlistTextUtils.cleanScrapedText(rawText);
        return cleaned || null;
    }

    function extractMetaProduct(doc = document) {
        const name =
            doc.querySelector('meta[property="og:title"]')?.content ||
            doc.querySelector('meta[name="twitter:title"]')?.content ||
            null;

        const imageUrl =
            doc.querySelector('meta[property="og:image"]')?.content ||
            doc.querySelector('meta[name="twitter:image"]')?.content ||
            null;

        const price =
            doc.querySelector('meta[property="product:price:amount"]')
                ?.content ||
            doc.querySelector('meta[property="og:price:amount"]')?.content ||
            null;

        const currency =
            doc.querySelector('meta[property="product:price:currency"]')
                ?.content || null;

        return { name, price, currency, imageUrl };
    }

    // Reads whatever src-like value an element actually has, preferring
    // the live rendered source over the original markup attribute -
    // currentSrc reflects what the browser actually picked (responsive
    // images, lazy-load swaps), src is the fallback, data-src covers
    // lazy-loaded images that haven't swapped their real src in yet. A
    // <meta itemprop="image" content="..."> has none of those, only
    // content.
    function readImageElementSrc(element) {
        if (!element) {
            return null;
        }

        if (element.tagName === "META") {
            return element.content || null;
        }

        return (
            element.currentSrc ||
            element.src ||
            element.getAttribute("data-src") ||
            null
        );
    }

    // Conservative, non-retailer-specific "main product image" finder,
    // shared by the image fallback (below) and the image-alt name
    // fallback. Prefers the one semantic microdata marker already used
    // elsewhere in this file ([itemprop="image"]); otherwise falls back
    // to the first sufficiently-large *visible* <img> in document order -
    // deliberately not "the first img" with no size/visibility filter
    // (which is just as likely to be a logo, nav icon, or an unrelated
    // recommendation-card thumbnail), and deliberately not "the largest
    // img" either: a product gallery's own DOM order already represents
    // its primary-image order, and picking by rendered area alone can
    // land on a later gallery image instead of the first one.
    function findLikelyMainProductImage(doc) {
        const semanticImage = doc.querySelector('[itemprop="image"]');
        if (semanticImage) {
            return semanticImage;
        }

        return (
            [...doc.querySelectorAll("img")].find((img) => {
                const rect = img.getBoundingClientRect();
                return (
                    rect.width >= MIN_LIKELY_PRODUCT_IMAGE_DIMENSION &&
                    rect.height >= MIN_LIKELY_PRODUCT_IMAGE_DIMENSION &&
                    img.offsetParent !== null
                );
            }) || null
        );
    }

    // Finds the first h1 in document order whose text isn't empty -
    // deliberately not "the first h1", which on at least one real
    // retailer page is an empty placeholder ahead of the real title.
    function firstNonEmptyHeadingElement(doc) {
        const headings = doc.querySelectorAll("h1");

        for (const heading of headings) {
            if (WishlistTextUtils.cleanScrapedText(heading.textContent)) {
                return heading;
            }
        }

        return null;
    }

    // Conservative generic price fallback for pages with no structured/
    // meta price and no Amazon-style price element. Rather than
    // scanning the whole document (which risks matching a recommended-
    // product's price, a promo banner, or a cart total), this only
    // looks within a small subtree around the product name/title -
    // title and price sit adjacent in essentially every product-page
    // layout, which bounds the search to where a product's own price
    // actually lives without assuming anything about a specific
    // retailer's markup. Only considers leaf elements (no child
    // elements, so it can't match a big container that merely contains
    // a price somewhere inside unrelated text), only elements that are
    // actually rendered, and skips anything styled with a strikethrough
    // (a crossed-out compare-at price when a real current price is
    // likely available elsewhere nearby).
    function findNearbyPriceText(doc, nameElement) {
        if (!nameElement) {
            return null;
        }

        let container = nameElement;
        for (
            let level = 0;
            level < PRICE_SEARCH_ANCESTOR_LEVELS && container.parentElement;
            level++
        ) {
            container = container.parentElement;
        }

        const candidates = container.querySelectorAll("*");

        for (const element of candidates) {
            if (element.children.length > 0) {
                continue;
            }

            const text = WishlistTextUtils.cleanScrapedText(element.textContent);
            if (!PRICE_TEXT_PATTERN.test(text)) {
                continue;
            }

            if (element.offsetParent === null) {
                continue;
            }

            if (getComputedStyle(element).textDecorationLine.includes("line-through")) {
                continue;
            }

            return text.replace(/[^0-9.]/g, "") || null;
        }

        return null;
    }

    // The Amazon-specific fallbacks from the original scraper, kept
    // as-is (same elements, same attributes) - preserved per the
    // "don't delete working Amazon support" instruction. Two
    // correctness fixes were applied when this was pulled out of
    // content.js (documented in the Phase 1 report): the
    // data-old-hires/data-a-dynamic-image branch had an operator-
    // precedence bug that discarded data-old-hires whenever
    // data-a-dynamic-image was also present, and a malformed
    // data-a-dynamic-image value could throw uncaught.
    function extractDomProduct(doc = document) {
        let nameElement = doc.querySelector("#productTitle");
        let name = cleanNonEmpty(nameElement?.textContent);

        if (!name) {
            nameElement = doc.querySelector('[itemprop="name"]');
            name = cleanNonEmpty(nameElement?.textContent);
        }

        if (!name) {
            nameElement = firstNonEmptyHeadingElement(doc);
            name = nameElement
                ? WishlistTextUtils.cleanScrapedText(nameElement.textContent)
                : null;
        }

        // [itemprop="image"] used to also live inside the Amazon-only
        // image lookup below; it's genuinely generic semantic markup,
        // not an Amazon convention, so it's now resolved once here via
        // findLikelyMainProductImage and shared with the alt-text name
        // fallback immediately below.
        const mainImage = findLikelyMainProductImage(doc);

        // Emergency last resort: the alt text of the same "likely main
        // image" already identified above - only when it's a real <img>
        // (a <meta itemprop="image"> has no alt), and only after every
        // other, more specific name source has failed.
        if (!name && mainImage?.tagName === "IMG") {
            name = cleanNonEmpty(mainImage.getAttribute("alt"));
            if (name) {
                nameElement = mainImage;
            }
        }

        let imageUrl = null;
        const amazonImageElement =
            doc.querySelector("#landingImage") ||
            doc.querySelector("#imgTagWrapperId img");

        if (amazonImageElement) {
            const oldHires = amazonImageElement.getAttribute("data-old-hires");
            const dynamicImageAttr = amazonImageElement.getAttribute(
                "data-a-dynamic-image"
            );

            if (oldHires) {
                imageUrl = oldHires;
            } else if (dynamicImageAttr) {
                try {
                    imageUrl = Object.keys(JSON.parse(dynamicImageAttr))[0] || null;
                } catch {
                    imageUrl = null;
                }
            } else {
                imageUrl = amazonImageElement.src || null;
            }
        }

        if (!imageUrl) {
            imageUrl = readImageElementSrc(mainImage);
        }

        let price = null;
        const priceElement =
            doc.querySelector(
                "#corePriceDisplay_desktop_feature_div .a-offscreen"
            ) ||
            doc.querySelector("#corePrice_feature_div .a-offscreen") ||
            doc.querySelector(".a-price .a-offscreen") ||
            doc.querySelector('[itemprop="price"]');

        if (priceElement) {
            const cleanedText = WishlistTextUtils.cleanScrapedText(
                priceElement.textContent
            );
            price = cleanedText.replace(/[^0-9.]/g, "") || null;
        }

        if (!price) {
            price = findNearbyPriceText(doc, nameElement);
        }

        return { name, price, imageUrl };
    }

    function extractSelectedColor(doc = document) {
        for (const selector of COLOR_SELECTORS) {
            const element = doc.querySelector(selector);

            if (element?.textContent.trim()) {
                return element.textContent.trim();
            }
        }

        return null;
    }

    function extractCanonicalUrl(doc = document, currentLocation = window.location) {
        const canonicalHref = doc.querySelector('link[rel="canonical"]')?.href;
        return canonicalHref || currentLocation.href;
    }

    function extractStore(currentLocation = window.location) {
        return currentLocation.hostname.replace(/^www\./, "");
    }

    return {
        extractMetaProduct,
        extractDomProduct,
        extractSelectedColor,
        extractCanonicalUrl,
        extractStore,
    };
})();
