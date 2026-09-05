// Get the Save button
const saveButton = document.getElementById("saveButton");

const saveMessage = document.getElementById("saveMessage");
const productContainer = document.getElementById("product");
const wishlistButton = document.getElementById("wishlistButton");

// Same action "View Wishlist" already performs - reused, not
// duplicated, as the one way to sign in (the wishlist page is the only
// login UI; the popup never gets its own email/password fields).
function openWishlist() {
    chrome.tabs.create({
        url: chrome.runtime.getURL("wishlist/index.html")
    });
}

function displayProduct(product) {
    productContainer.innerHTML = `
        <img
            src="${product.imageUrl}"
            width="150"
        >

        <h2>${product.name}</h2>

        <p>${product.store}</p>

        <p>${product.color || ""}</p>

        <p>$${product.price}</p>
    `;
}

// Whether the last auth check found a usable session - read by the
// click handler so a signed-out/expired popup opens the wishlist
// instead of attempting (and always failing) a save. This is a UX
// short-circuit only: WishlistService.saveWishlistItem() independently
// re-checks the session itself before ever calling Supabase, so a
// stale value here can never cause an unauthenticated insert attempt.
let hasUsableSession = false;

// Reflects the current session state in the Save button itself, before
// the user ever clicks it - "no session" and "expired" are both
// resolved the same way (open the wishlist to sign in), matching the
// wishlist page being the app's one login UI.
async function refreshAuthState() {
    const config = globalThis.WishlistExtensionConfig;

    if (!config?.supabaseUrl) {
        hasUsableSession = false;
        return;
    }

    const sessionResult = await WishlistAuthSession.getStoredSession(config.supabaseUrl);
    hasUsableSession = sessionResult.status === "valid";

    if (sessionResult.status === "signed_out") {
        saveButton.textContent = "Sign In To Save";
        saveMessage.textContent = "Open your wishlist to sign in.";
    } else if (sessionResult.status === "expired") {
        saveButton.textContent = "Sign In To Save";
        saveMessage.textContent = "Session expired. Open your wishlist to sign in again.";
    } else {
        saveButton.textContent = "Save Item";
        saveMessage.textContent = "";
    }
}

// When the Save button is clicked
saveButton.addEventListener("click", async () => {

    if (!hasUsableSession) {
        openWishlist();
        return;
    }

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    chrome.tabs.sendMessage(
        tab.id,
        { action: "extractProduct" },
        async (product) => {

            if (!product || !product.name || !product.imageUrl) {
                saveMessage.textContent = "Product not found.";
                return;
            }

            const result = await WishlistService.saveWishlistItem(product);

            if (result.duplicate) {
                saveMessage.textContent = "Item already saved.";
                return;
            }

            if (result.authRequired) {
                // Covers both "turned out to have no/expired session
                // after all" and "Supabase itself rejected the token" -
                // either way, re-run the upfront check so the button
                // correctly reflects the real state on the next click
                // instead of staying stuck offering "Save Item".
                saveMessage.textContent =
                    result.sessionStatus === "expired"
                        ? "Session expired. Open your wishlist to sign in again."
                        : "Sign in to save. Open your wishlist to sign in.";
                await refreshAuthState();
                return;
            }

            if (!result.success) {
                saveMessage.textContent = result.savedLocally
                    ? "Saved locally. Supabase unavailable."
                    : "Could not save item.";
                return;
            }

            displayProduct(product);
            saveMessage.textContent = "✓ Item Saved!";
        }
    );
});


// Load product when popup opens
async function loadProduct() {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    chrome.tabs.sendMessage(
        tab.id,
        { action: "extractProduct" },
        (product) => {
            if (!product) return;
            displayProduct(product);
        }
    );
}

loadProduct();
refreshAuthState();

wishlistButton.addEventListener("click", openWishlist);
