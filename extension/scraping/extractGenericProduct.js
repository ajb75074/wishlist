const WishlistGenericProduct = (() => {
    const COLOR_SELECTORS = [
        '[data-testid="swatch-color-title"]',
        '[data-testid="selected-color"]',
        '[aria-selected="true"][data-color]',
        '[aria-checked="true"][data-color]',
        "#variation_color_name .selection",
        "#variation_color_name span",
    ];

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

    // Prefers currentSrc (what the browser actually picked) over the markup
    // attribute, then lazy-load attributes.
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

    // Conservative, non-retailer-specific main-image finder: semantic marker
    // first, then the largest visible <img>.
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

    // Generic price fallback: searches only near the product title, and only
    // leaf elements whose entire text is a currency amount.
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

    // Amazon-specific fallbacks, kept as-is from the original scraper.
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

        const mainImage = findLikelyMainProductImage(doc);

        // Last resort: alt text of the likely main image, only when it's a
        // real <img>.
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
