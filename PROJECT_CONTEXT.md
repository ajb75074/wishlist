# Wishlist App — Project Context & Chat History

## What we're building

A Chrome extension + React wishlist app that lets users save products from ecommerce websites into one centralized wishlist.

The goal is to make the experience feel normalized across different ecommerce sites rather than building completely separate flows for every website.

Core flow:

Chrome Extension
→ Product scraper
→ Normalized product object
→ Database
→ React Wishlist
→ Wishlist UI

---

# IMPORTANT PROJECT HISTORY

## 1. Product scraping

We started by building a product scraper in the Chrome extension.

The scraper looks for structured ecommerce data first, especially JSON-LD:

- `Product`
- `ProductGroup`

Then it falls back to standard metadata such as:

- `og:title`
- `og:image`
- `product:price:amount`
- `og:price:amount`
- `product:price:currency`

Then it uses product-page DOM fallbacks when necessary.

### Fashion Nova discovery

Fashion Nova uses multiple JSON-LD scripts.

The important discovery was:

1. Organization
2. ProductGroup
3. BreadcrumbList

We learned NOT to hardcode an array index like `[1]`.

Instead, JSON-LD should be searched by `@type`.

Example approach:

```js
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
                // extract product information
            }
        }
    } catch (error) {
        // Skip invalid JSON-LD
    }
}
```

For Fashion Nova, the selected color could be found with:

```js
document.querySelector(
    '[data-testid="swatch-color-title"]'
)?.textContent.trim()
```

The product variant could then be matched by color and its offer used for price/image.

---

# 2. Normalized product object

We wanted every website to eventually produce the SAME data structure.

Current normalized object:

```js
{
    id,
    name,
    price,
    currency,
    imageUrl,
    color,
    productUrl,
    store,
    dateSaved
}
```

Example:

```js
{
    color: "Black",
    currency: "USD",
    imageUrl: "https://...",
    name: "Candace Lounge Set",
    price: "20.00",
    productUrl: "https://www.fashionnova.com/products/candace-lounge-set?color=black",
    store: "Fashion Nova"
}
```

Important principle:

DO NOT create completely different product formats for Fashion Nova, Amazon, Zara, Nike, etc.

Normalize everything into one common structure.

---

# 3. Websites tested

The normalized scraper successfully worked on:

- Fashion Nova
- Zara
- PrettyLittleThing
- Nike

Amazon has been more difficult.

Amazon sometimes returned bad data such as:

- name: "Chat history"
- price: null
- imageUrl: an Amazon sprite/privacy image

We decided not to keep adding endless Amazon-specific scenarios.

The desired architecture is a general normalized scraper with sensible fallbacks.

If a product cannot be reliably extracted, the extension should be able to say:

```text
Product not found.
```

rather than saving garbage data.

---

# 4. Current Chrome extension save flow

The extension has:

- `popup.html`
- `popup.js`
- `content.js`

The popup has:

```html
<button id="saveButton">
    Save Item
</button>

<button id="wishlistButton">
    View Wishlist
</button>

<p id="saveMessage"></p>

<div id="product"></div>
```

The Save button asks the content script to extract the product:

```js
chrome.tabs.sendMessage(
    tab.id,
    { action: "extractProduct" },
    async (product) => {
        // handle product
    }
);
```

The extension previously saved products to:

```js
chrome.storage.local
```

That worked successfully.

We also added:

```text
✓ Item Saved!
```

after saving.

The extension was successfully reading and displaying product information after saving.

---

# 5. Chrome storage stage

Before moving to the database, we successfully built:

```text
Save Item
    ↓
Product scraper
    ↓
Normalized product
    ↓
chrome.storage.local
    ↓
React wishlist
```

React successfully read the stored wishlist.

React also listens for Chrome storage changes so the wishlist updates when a new item is saved.

Current React approach:

```js
useEffect(() => {
    chrome.storage.local.get("wishlist").then((result) => {
        setWishlist(result.wishlist || []);
    });

    const handleStorageChange = (changes, areaName) => {
        if (areaName === "local" && changes.wishlist) {
            setWishlist(changes.wishlist.newValue || []);
        }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
    };
}, []);
```

This worked when the React wishlist was opened through the Chrome extension.

---

# 6. React/Vite transition

We transitioned the wishlist page to React using Vite.

React app structure is approximately:

```text
web/
├── src/
│   ├── components/
│   │   └── ProductCard.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── supabase.js
└── ...
```

The React app is built with Vite.

The development server is:

```bash
npm run dev
```

Important:

`npm run dev` runs React at localhost and does NOT have access to Chrome extension APIs such as:

```js
chrome.storage.local
```

The built React app works when loaded as part of the Chrome extension.

We currently have a React wishlist page at:

```text
wishlist/index.html
```

with Vite-generated assets.

The Vite-generated `index.html` currently looks like:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Wishlist</title>
    <script type="module" crossorigin src="./assets/index-DiZnBxni.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-nqMpL4T3.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

Do not manually modify Vite's hashed asset names.

---

# 7. React ProductCard

React now receives actual product objects rather than hardcoded product information.

Conceptually:

```jsx
function ProductCard({ product }) {
    return (
        <div>
            <img
                src={product.imageUrl}
                alt={product.name}
                width="200"
            />

            <h2>{product.name}</h2>

            <p>{product.store}</p>

            <p>{product.color || ""}</p>

            <p>
                {product.price
                    ? `$${product.price}`
                    : "Price unavailable"}
            </p>
        </div>
    );
}

export default ProductCard;
```

---

# 8. View Wishlist button

The extension popup has a View Wishlist button.

Important DOM detail:

The button MUST appear before the popup script if the script runs immediately.

Working popup structure:

```html
<button id="saveButton">
    Save Item
</button>

<button id="wishlistButton">
    View Wishlist
</button>

<p id="saveMessage"></p>

<div id="product"></div>

<script src="popup.js"></script>
```

The button opens the React wishlist:

```js
const wishlistButton =
    document.getElementById("wishlistButton");

wishlistButton.addEventListener("click", () => {
    chrome.tabs.create({
        url: chrome.runtime.getURL("wishlist/index.html")
    });
});
```

This now works.

---

# 9. Database decision

We decided to move from `chrome.storage.local` to a real database.

Chosen database:

Supabase / PostgreSQL.

We decided that duplicate prevention should happen at the database level rather than only hiding duplicates in React.

The database should treat the normalized product URL as unique.

Important future consideration:

Product URLs can contain tracking parameters.

For example, two URLs may represent the same Amazon product:

```text
amazon.com/dp/B0DPLTHCDB?ref=abc
amazon.com/dp/B0DPLTHCDB?ref=xyz
```

Eventually create URL normalization so tracking parameters do not cause false duplicates.

---

# 10. Supabase database

Supabase project has already been created.

Project URL:

```text
https://cffvawaeampdspmatxpo.supabase.co
```

A `wishlist_items` table has already been created with:

```sql
create table wishlist_items (
    id uuid primary key default gen_random_uuid(),

    name text not null,

    price numeric,

    currency text default 'USD',

    image_url text,

    color text,

    product_url text not null unique,

    store text not null,

    date_saved timestamptz default now()
);
```

Important:

```sql
product_url text not null unique
```

is intentional duplicate protection.

---

# 11. Supabase credentials

Supabase provided:

```text
Project URL:
https://cffvawaeampdspmatxpo.supabase.co
```

Publishable key was provided in the conversation.

IMPORTANT SECURITY NOTE:

The publishable key is intended for client-side use.

Never put a Supabase secret/service-role key in the Chrome extension or React frontend.

If the key is needed in code, prefer an environment variable for the Vite app rather than committing credentials directly to Git.

---

# 12. Supabase React connection

The React project installed:

```bash
npm install @supabase/supabase-js
```

We created:

```text
src/supabase.js
```

The client is conceptually:

```js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://cffvawaeampdspmatxpo.supabase.co";

const supabaseKey = "YOUR_PUBLISHABLE_KEY";

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);
```

The Supabase connection was tested successfully from the React/Vite app.

A test query returned data successfully from:

```text
wishlist_items
```

The table was empty at the time, which was expected.

---

# 13. Current database transition status

We were about to change Save Item from:

```js
chrome.storage.local
```

to:

```js
supabase
```

The first attempted approach caused the extension to stop working because Supabase was imported into `popup.js` incorrectly.

We temporarily changed:

```html
<script src="popup.js"></script>
```

to:

```html
<script type="module" src="popup.js"></script>
```

but this caused extension functionality to break.

DO NOT blindly repeat that approach.

The existing scraper and extension functionality worked before this module/import change.

The next task should be to correctly connect the Chrome extension to Supabase without breaking the working content script/scraper.

---

# 14. Current desired architecture

The intended final architecture is:

```text
                PRODUCT WEBSITE
                      ↓
                 content.js
                      ↓
             Product extraction
                      ↓
             Normalize product
                      ↓
                 popup.js
                      ↓
                  Supabase
                      ↓
              wishlist_items
                      ↓
                React / Vite
                      ↓
               ProductCard
                      ↓
                Wishlist UI
```

We are intentionally moving away from:

```text
chrome.storage.local
```

as the primary database.

It was useful as an initial prototype, but Supabase should become the source of truth.

---

# 15. Duplicate handling

Desired behavior:

```text
User clicks Save
       ↓
Extract product
       ↓
Normalize product URL
       ↓
Supabase insert
       ↓
Is product_url already in database?
      ↙                  ↘
    YES                  NO
     ↓                    ↓
Don't duplicate       Save product
```

The database's UNIQUE constraint should be the final protection.

The UI can also prevent duplicate rendering, but the database should be authoritative.

---

# 16. UI direction

We have intentionally NOT started the final UI design yet.

The user has reference designs/concepts from Claude and plans to create their own design.

The desired wishlist experience is a dedicated page rather than trying to fit the entire wishlist into the extension popup.

The React page should eventually show:

- Product image
- Product name
- Store
- Price
- Color
- Product link
- Saved date
- Eventually actions such as delete/remove

But functionality/database should be solid before spending time on polished UI.

---

# 17. Current project philosophy

Important preferences/decisions:

- Keep the data model normalized across all websites.
- Avoid hardcoding a completely different extraction flow for every store.
- Prefer structured JSON-LD.
- Use metadata/DOM as fallbacks.
- Do not save unreliable data.
- Show "Product not found." when extraction fails.
- Use Supabase as the eventual source of truth.
- Prevent duplicates at the database level.
- Build functionality before polished UI.
- Keep comments simple.
- Make changes incrementally and test after each step.
- Do not unnecessarily rewrite working code.

---

# 18. Immediate next task

The next coding task is:

## Connect the Chrome extension Save Item button to Supabase safely.

Requirements:

1. Keep the existing product scraper working.
2. Keep the normalized product object.
3. Save the normalized product into `wishlist_items`.
4. Handle duplicate `product_url` values gracefully.
5. Keep the "✓ Item Saved!" message.
6. Show an appropriate message if the product is already saved.
7. Do not break the View Wishlist button.
8. Do not rely on `chrome.storage.local` as the primary database.
9. Test that a real saved product appears in Supabase Table Editor.
10. Then update React to read from Supabase instead of Chrome storage.

---

# 19. Development workflow

After making changes:

```bash
npm run build
```

Then reload the Chrome extension.

For React-only testing:

```bash
npm run dev
```

Remember that localhost is not the same environment as the Chrome extension.

Always inspect the actual extension when testing Chrome APIs.

---

# 20. How to work on this project

Before making significant changes:

1. Inspect the existing files.
2. Understand the current architecture.
3. Preserve working scraper behavior.
4. Make the smallest necessary change.
5. Test it.
6. Explain what changed.
7. Only then move to the next step.

Do not assume a file location or rewrite large sections without checking the project structure.

