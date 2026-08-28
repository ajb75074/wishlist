// Get the Save button
const saveButton = document.getElementById("saveButton");

// When the Save button is clicked
saveButton.addEventListener("click", async () => {

    console.log("Save button clicked!");

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    chrome.tabs.sendMessage(
        tab.id,
        { action: "extractProduct" },
        async (product) => {

            console.log("Product received:", product);

            if (!product) {
                console.log("No product found.");
                return;
            }

            // Get the existing wishlist
            const result = await chrome.storage.local.get("wishlist");

            console.log("Existing wishlist:", result);

            // If no wishlist exists yet, create an empty array
            const wishlist = result.wishlist || [];

            // Add the new product
            wishlist.push(product);

            console.log("Wishlist after adding:", wishlist);

            // Save the updated wishlist
            await chrome.storage.local.set({
                wishlist: wishlist
            });

            console.log("Wishlist saved!");

            // Show the product in the popup
            const productContainer =
                document.getElementById("product");

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

            // Show save confirmation
            const saveMessage =
                document.getElementById("saveMessage");

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

            if (!product) {
                console.log("No product found.");
                return;
            }

            console.log("Product loaded:", product);

            // Display product
            const productContainer =
                document.getElementById("product");

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
    );
}

loadProduct();

chrome.storage.local.get("wishlist").then(result => {
    console.log("CURRENT WISHLIST:", result);
});