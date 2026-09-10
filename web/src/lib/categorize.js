// Infers a broad category from a product's name
const CATEGORY_KEYWORDS = {
  Tops: [
    "shirt", "tee", "t-shirt", "top", "blouse", "tank", "camisole", "cami",
    "bodysuit", "sweater", "hoodie", "cardigan", "crop", "jacket", "jackets",
    "zip up", "zip-up", "zipup", "jersey", "crew", "sweatshirt", "pullover", 
    "vest", "anorak", "parka", "blazer","coat", "trench", "windbreaker", 
    "anorak", "peacoat", "puffer", "anorak", "poncho", "kimono", "shrug", 
    "bolero", "wrap", "cape", "duster",
  ],
  Bottoms: [
    "pant", "pants", "jean", "jeans", "trouser", "trousers", "legging",
    "leggings", "short", "shorts", "skirt", "sweatpant", "sweatpants",
    "jogger", "joggers", "culotte", "capri", "chino", "cargo", "corduroy",
    "palazzo", "flare", "bootcut", "skinny", "wide-leg", "slacks", "treggings",
  ],
  Dresses: ["dress", "gown", "jumpsuit", "romper", "playsuit", 
    "maxi", "midi", "sheath", "shift", "wrap dress"],
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
    "headband", "beanie", "cap", "visor", "glasses", "wallet", "keychain", "brooch", "cufflink",
     "tie", "bowtie", "hairpin", "hairpins", "hairband", "hairbands", "anklet", "choker", "bandana",
  ],
};

export const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Shoes", "Bags", "Accessories", "Other"];

const CATEGORY_PATTERNS = Object.entries(CATEGORY_KEYWORDS).map(
  ([category, keywords]) => [category, new RegExp(`\\b(${keywords.join("|")})\\b`, "i")],
);

export function categorizeProduct(product) {
  const name = (product.name ?? "").toLowerCase();

  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(name)) {
      return category;
    }
  }

  return "Other";
}
