// Infers a broad category from a product's name, so items like "sandals"
// or "wedges" can be filtered under "Shoes" without a category column
// in the database.
const CATEGORY_KEYWORDS = {
  Tops: [
    "shirt", "tee", "t-shirt", "top", "blouse", "tank", "camisole", "cami",
    "bodysuit", "sweater", "hoodie", "cardigan", "crop", "jacket", "jackets",
    "zip up", "zip-up", "zipup", "jersey"
  ],
  Bottoms: [
    "pant", "pants", "jean", "jeans", "trouser", "trousers", "legging",
    "leggings", "short", "shorts", "skirt", "sweatpant", "sweatpants",
  ],
  Dresses: ["dress", "gown", "jumpsuit", "romper"],
  Shoes: [
    "shoe", "shoes", "sandal", "sandals", "wedge", "wedges", "heel", "heels",
    "sneaker", "sneakers", "boot", "boots", "flat", "flats", "loafer",
    "loafers", "mule", "mules", "slipper", "slippers", "pump", "pumps", "cow", "cowhide"
  ],
  Bags: [
    "bag", "purse", "tote", "clutch", "backpack", "handbag", "satchel", "crossbody",
    "shoulder bag", "duffel", "briefcase", "fanny pack", "belt bag",
  ],
  Accessories: [
    "necklace", "earring", "earrings", "bracelet", "ring", "belt", "hat",
    "scarf", "sunglasses", "watch", "glove", "gloves", "hair clip", "hair clips", 
    "headband", "beanie", "cap", "visor", "glasses", "wallet", "keychain", "brooch", "cufflink", "tie", "bowtie",
  ],
};

export const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Shoes", "Bags", "Accessories", "Other"];

export function categorizeProduct(product) {
  const name = (product.name ?? "").toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = keywords.some((keyword) =>
      new RegExp(`\\b${keyword}\\b`, "i").test(name),
    );

    if (matches) {
      return category;
    }
  }

  return "Other";
}
