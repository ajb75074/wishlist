function extractProduct() {
    const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
    );

    let productData = null;

    for (const script of scripts) {
        try {
            const data = JSON.parse(script.textContent);
            const items = Array.isArray(data) ? data : [data];

            for (const item of items) {
                if (
                    item["@type"] === "Product" ||
                    item["@type"] === "ProductGroup"
                ) {
                    productData = item;
                    break;
                }
            }

            if (productData) break;

        } catch (error) {
            continue;
        }
    }

    if (!productData) {
        console.log("Could not find product data");
        return null;
    }

    const name = productData.name || null;

    const store =
        productData.brand?.name ||
        document.querySelector('meta[property="og:site_name"]')?.content ||
        window.location.hostname;

    const productUrl =
        productData.url ||
        document.querySelector('meta[property="og:url"]')?.content ||
        window.location.href;

    let imageUrl = null;

    if (Array.isArray(productData.image)) {
        imageUrl = productData.image[0];
    } else if (typeof productData.image === "string") {
        imageUrl = productData.image;
    }

    if (!imageUrl) {
        imageUrl =
            document.querySelector('meta[property="og:image"]')?.content ||
            null;
    }

    let price = null;
    let currency = null;

    if (productData.hasVariant?.length) {
        const variant = productData.hasVariant[0];

        price = variant.offers?.price || null;
        currency = variant.offers?.priceCurrency || null;

        if (!imageUrl && variant.image) {
            imageUrl = variant.image;
        }
    }

    if (!price && productData.offers) {
        const offers = Array.isArray(productData.offers)
            ? productData.offers[0]
            : productData.offers;

        price = offers?.price || null;
        currency = offers?.priceCurrency || null;
    }

    const color =
        productData.color ||
        productData.hasVariant?.[0]?.color ||
        null;

    const product = {
        name,
        price,
        currency,
        imageUrl,
        productUrl,
        store,
        color
    };

    console.log("Extracted product:", product);

    return product;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "extractProduct") {
        const product = extractProduct();
        sendResponse(product);
    }
});