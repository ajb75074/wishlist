// Get the Save button
const saveButton = document.getElementById("saveButton");

const saveMessage = document.getElementById("saveMessage");
const productContainer = document.getElementById("product");

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

// When the Save button is clicked
saveButton.addEventListener("click", async () => {

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

const wishlistButton = document.getElementById("wishlistButton");

wishlistButton.addEventListener("click", () => {
    chrome.tabs.create({
        url: chrome.runtime.getURL("wishlist/index.html")
    });
});
