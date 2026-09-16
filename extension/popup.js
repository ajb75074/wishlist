
const app = document.getElementById("app");

const HEART_ICON = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
  <path d="M12 20.5s-7.5-4.6-10-9.3C.4 8.1 1.9 4.8 5 4c2-.5 4 .3 5.2 2.1L12 8.4l1.8-2.3C15 4.3 17 3.5 19 4c3.1.8 4.6 4.1 3 7.2-2.5 4.7-10 9.3-10 9.3Z"/>
</svg>`;

const HEART_ICON_SMALL = `
<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
  <path d="M12 20.5s-7.5-4.6-10-9.3C.4 8.1 1.9 4.8 5 4c2-.5 4 .3 5.2 2.1L12 8.4l1.8-2.3C15 4.3 17 3.5 19 4c3.1.8 4.6 4.1 3 7.2-2.5 4.7-10 9.3-10 9.3Z"/>
</svg>`;

const BAG_ICON = `
<svg viewBox="0 0 48 48" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M15 18v-4a9 9 0 0 1 18 0v4"/>
  <rect x="8" y="18" width="32" height="23" rx="4"/>
  <path d="M40 12l3 1.5M41 18l3-1"/>
</svg>`;

const PLACEHOLDER_ICON = `
<svg viewBox="0 0 48 48" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M24 6c2 0 3.5 1.5 3.5 3.5"/>
  <path d="M24 9.5V15"/>
  <path d="M24 15 9 24l3 5 12-6.5L36 29l3-5z"/>
  <path d="M15 27l-6 14h30l-6-14"/>
</svg>`;

const CHECK_ICON = `
<svg class="wl-success__check" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--wl-pink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M5 12.5 9.5 17 19 7.5"/>
</svg>`;

// Escapes scraped text before it reaches innerHTML - the source page is
// untrusted.
function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// store is the scraper's hostname value, never a real brand name.
function formatStoreLabel(store) {
    if (!store) return "";
    const withoutTld = store.replace(/\.(com|co|net|org|io|shop|store)(\.[a-z]{2})?$/i, "");
    return withoutTld.toUpperCase();
}

// Normalizes chrome.runtime's "no receiving end" failure (chrome:// pages, or
// a not-yet-injected content script).
function requestProduct(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: "GET_PRODUCT" }, (response) => {
            if (chrome.runtime.lastError || !response) {
                resolve({ success: false, reason: "EXTRACTION_ERROR" });
                return;
            }
            resolve(response);
        });
    });
}

function openWishlist() {
    chrome.tabs.create({
        url: globalThis.WishlistExtensionConfig.appUrl
    });
}

function setNote(el, text, kind) {
    if (!el) return;

    if (!text) {
        el.hidden = true;
        el.textContent = "";
        el.classList.remove("wl-inline-note--error");
        return;
    }

    el.hidden = false;
    el.textContent = text;
    el.classList.toggle("wl-inline-note--error", kind === "error");
}

function headerHtml() {
    return `
        <div class="wl-header">
            <span class="wl-wordmark">wishlist</span>
            <button type="button" class="wl-header__wishlist-btn" id="headerWishlistBtn" aria-label="View wishlist">
                ${HEART_ICON}
            </button>
        </div>
    `;
}

function bindHeader() {
    document.getElementById("headerWishlistBtn").addEventListener("click", openWishlist);
}

function renderLoading() {
    app.innerHTML = `
        ${headerHtml()}
        <div class="wl-skeleton" aria-hidden="true">
            <div class="wl-skeleton__image wl-shimmer"></div>
            <div class="wl-skeleton__line wl-shimmer" style="width:78%"></div>
            <div class="wl-skeleton__line wl-shimmer wl-skeleton__line--sm" style="width:46%"></div>
            <div class="wl-skeleton__line wl-shimmer wl-skeleton__line--sm" style="width:30%"></div>
            <div class="wl-skeleton__button wl-shimmer"></div>
        </div>
    `;
    bindHeader();
}

function renderExtractionError() {
    app.innerHTML = `
        ${headerHtml()}
        <div class="wl-empty wl-anim-in">
            <div class="wl-empty__icon">${BAG_ICON}</div>
            <h2 class="wl-empty__title">No product found</h2>
            <p class="wl-empty__body">We couldn't find a product on this page.</p>
            <div class="wl-empty__tips">
                <p class="wl-empty__tips-title">Try another page</p>
                <ul class="wl-empty__tips-list">
                    <li>Make sure you're on a product page (not a homepage or category page)</li>
                    <li>Look for a specific item with a price</li>
                </ul>
            </div>
            <button type="button" class="wl-btn wl-btn--primary" id="tryAgainButton">Try Again</button>
        </div>
    `;

    bindHeader();
    document.getElementById("tryAgainButton").addEventListener("click", loadProduct);
}

function renderInfoRows(product) {
    const rows = [];

    if (product.price) {
        rows.push(`
            <div class="wl-row">
                <span class="wl-row__label">Price</span>
                <span class="wl-row__value">$${escapeHtml(product.price)}</span>
            </div>
        `);
    }

    if (product.color) {
        rows.push(`
            <div class="wl-row">
                <span class="wl-row__label">Color</span>
                <span class="wl-row__value">${escapeHtml(product.color)}</span>
            </div>
        `);
    }

    return rows.length ? `<div class="wl-product__rows">${rows.join("")}</div>` : "";
}

function renderProduct(product) {
    const hasImage = !!product.imageUrl;

    app.innerHTML = `
        ${headerHtml()}
        <div class="wl-product wl-anim-in" id="productScreen">
            <div class="wl-product__image-frame" id="imageFrame">
                ${hasImage ? `<img class="wl-product__image" id="productImage" alt="" src="${escapeHtml(product.imageUrl)}">` : ""}
                <div class="wl-product__image-placeholder" id="imagePlaceholder">${PLACEHOLDER_ICON}</div>
            </div>
            <h2 class="wl-product__name">${escapeHtml(product.name)}</h2>
            ${product.store ? `<p class="wl-product__store">${escapeHtml(formatStoreLabel(product.store))}</p>` : ""}
            ${renderInfoRows(product)}
            <button type="button" class="wl-btn wl-btn--primary" id="saveButton">
                <span class="wl-btn__spinner" aria-hidden="true"></span>
                <span class="wl-btn__heart" aria-hidden="true">${HEART_ICON_SMALL}</span>
                <span class="wl-btn__label">Save to Wishlist</span>
            </button>
            <p class="wl-inline-note" id="saveNote" role="status" hidden></p>
        </div>
    `;

    bindHeader();

    const imageFrame = document.getElementById("imageFrame");
    const img = document.getElementById("productImage");

    if (img) {
        img.addEventListener("error", () => imageFrame.classList.add("is-broken"));
    } else {
        imageFrame.classList.add("is-broken");
    }

    document.getElementById("saveButton").addEventListener("click", handleSaveClick);

    refreshAuthState();
}

function renderSuccess(product) {
    const hasImage = !!product.imageUrl;

    app.innerHTML = `
        <div class="wl-success">
            <div class="wl-success__badge">
                ${CHECK_ICON}
            </div>
            <p class="wl-success__title">Saved!</p>
            <p class="wl-success__subtitle">Added to your wishlist</p>
            <div class="wl-success__summary">
                <div class="wl-success__thumb-frame" id="successThumbFrame">
                    ${hasImage ? `<img class="wl-success__thumb" id="successThumb" alt="" src="${escapeHtml(product.imageUrl)}">` : PLACEHOLDER_ICON}
                </div>
                <div class="wl-success__summary-text">
                    <p class="wl-success__name">${escapeHtml(product.name)}</p>
                    ${product.store ? `<p class="wl-success__store">${escapeHtml(formatStoreLabel(product.store))}</p>` : ""}
                    ${product.price ? `<p class="wl-success__price">$${escapeHtml(product.price)}</p>` : ""}
                </div>
            </div>
            <button type="button" class="wl-btn wl-btn--primary wl-success__cta" id="viewWishlistSuccess">View Wishlist</button>
            <p class="wl-success__footer">${HEART_ICON_SMALL} Building your dream wardrobe</p>
        </div>
    `;

    const thumb = document.getElementById("successThumb");
    if (thumb) {
        thumb.addEventListener("error", () => {
            document.getElementById("successThumbFrame").innerHTML = PLACEHOLDER_ICON;
        });
    }

    document.getElementById("viewWishlistSuccess").addEventListener("click", openWishlist);
}

// Brief exit animation before swapping screens; skipped when reduced motion
// is requested.
function playExitThenRenderSuccess(product) {
    const screen = document.getElementById("productScreen");

    if (!screen || prefersReducedMotion()) {
        renderSuccess(product);
        return;
    }

    screen.classList.add("wl-exit");
    setTimeout(() => renderSuccess(product), 200);
}

// Whether the last auth check found a usable session - a signed-out popup
// opens the wishlist instead of failing a save.
let hasUsableSession = false;

async function refreshAuthState() {
    const saveButton = document.getElementById("saveButton");
    if (!saveButton) return;

    const label = saveButton.querySelector(".wl-btn__label");
    const note = document.getElementById("saveNote");
    const config = globalThis.WishlistExtensionConfig;

    if (!config?.supabaseUrl) {
        hasUsableSession = false;
        return;
    }

    const sessionResult = await WishlistAuthSession.getStoredSession(config.supabaseUrl);
    hasUsableSession = sessionResult.status === "valid";

    if (sessionResult.status === "signed_out") {
        label.textContent = "Sign In to Save";
        setNote(note, "Open your wishlist to sign in.", "info");
    } else if (sessionResult.status === "expired") {
        label.textContent = "Sign In to Save";
        setNote(note, "Session expired. Open your wishlist to sign in again.", "info");
    } else {
        label.textContent = "Save to Wishlist";
        setNote(note, "", "clear");
    }
}

// Synchronous lock, checked and set in the same tick as the click -
// the original popup had no protection at all against a rapid
// double-click firing two concurrent save attempts.
let isSaving = false;

async function handleSaveClick() {
    if (isSaving) return;

    if (!hasUsableSession) {
        openWishlist();
        return;
    }

    const saveButton = document.getElementById("saveButton");
    const saveNote = document.getElementById("saveNote");
    const label = saveButton.querySelector(".wl-btn__label");

    isSaving = true;
    setNote(saveNote, "", "clear");
    saveButton.disabled = true;
    saveButton.classList.add("is-saving");
    label.textContent = "Saving...";

    function resetButton() {
        isSaving = false;
        saveButton.disabled = false;
        saveButton.classList.remove("is-saving");
        label.textContent = "Save to Wishlist";
    }

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    // A fresh extraction, so Save always uses up-to-date variant state.
    const extraction = await requestProduct(tab.id);

    if (!extraction.success) {
        resetButton();
        setNote(saveNote, "Couldn't save this item. Try again.", "error");
        return;
    }

    const product = WishlistProductUtils.normalizeProduct(extraction.product);
    const result = await WishlistService.saveWishlistItem(product);

    if (result.duplicate) {
        resetButton();
        setNote(saveNote, "Item already saved.", "error");
        return;
    }

    if (result.authRequired) {
        // Covers both a missing session and a token Supabase rejected - re-
        // run the check either way.
        resetButton();
        setNote(
            saveNote,
            result.sessionStatus === "expired"
                ? "Session expired. Open your wishlist to sign in again."
                : "Sign in to save. Open your wishlist to sign in.",
            "error"
        );
        await refreshAuthState();
        return;
    }

    if (!result.success) {
        resetButton();
        setNote(
            saveNote,
            result.savedLocally ? "Saved locally. Supabase unavailable." : "Couldn't save this item. Try again.",
            "error"
        );
        return;
    }

    // result.product is the raw DB row (snake_case) - display uses the
    // already-normalized extraction result instead, same as the
    // original popup did.
    isSaving = false;
    playExitThenRenderSuccess(product);
}

async function loadProduct() {
    renderLoading();

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    const extraction = await requestProduct(tab.id);

    if (!extraction.success) {
        renderExtractionError();
        return;
    }

    renderProduct(WishlistProductUtils.normalizeProduct(extraction.product));
}

loadProduct();
