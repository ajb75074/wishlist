// Maps a scraped color string (e.g. "Brown Combo", "Dusty Rose") down to
// one of a small set of basic colors, so the filter doesn't show every
// literal shade name a store happens to use.
const BASIC_COLOR_KEYWORDS = {
  Black: ["black", "onyx", "jet"],
  White: ["white", "ivory", "cream", "off-white", "off white"],
  Gray: ["gray", "grey", "charcoal", "heather"],
  Brown: [
    "brown", "tan", "beige", "camel", "khaki", "taupe", "chocolate", "mocha",
    "nude",
  ],
  Red: ["red", "maroon", "burgundy", "wine", "crimson", "rust"],
  Pink: ["pink", "rose", "blush", "fuchsia", "magenta"],
  Orange: ["orange", "peach", "coral", "apricot"],
  Yellow: ["yellow", "mustard", "gold"],
  Green: ["green", "olive", "sage", "mint", "emerald"],
  Blue: ["blue", "navy", "teal", "denim", "turquoise", "cyan"],
  Purple: ["purple", "lavender", "lilac", "violet", "plum"],
  Multi: ["multi", "combo", "print", "floral", "plaid", "striped", "stripe"],
};

export const BASIC_COLORS = Object.keys(BASIC_COLOR_KEYWORDS);

export function basicColor(rawColor) {
  const value = (rawColor ?? "").toLowerCase();
  if (!value) return null;

  for (const [basic, keywords] of Object.entries(BASIC_COLOR_KEYWORDS)) {
    const matches = keywords.some((keyword) =>
      new RegExp(`\\b${keyword}\\b`, "i").test(value),
    );

    if (matches) {
      return basic;
    }
  }

  return null;
}
