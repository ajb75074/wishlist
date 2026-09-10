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

export const BASIC_COLOR_SWATCHES = {
  Black: "#2b2224",
  White: "#fdfaf6",
  Gray: "#9a9096",
  Brown: "#8a5a3f",
  Red: "#b23a3a",
  Pink: "var(--strawberry)",
  Orange: "#d98a4f",
  Yellow: "#d9b65c",
  Green: "var(--matcha)",
  Blue: "#5f7ea6",
  Purple: "#8d6fa8",
  Multi: "conic-gradient(#e95d75, #d9b65c, #78966b, #5f7ea6, #8d6fa8, #e95d75)",
};

// Compiled once at module load, not per call.
const BASIC_COLOR_PATTERNS = Object.entries(BASIC_COLOR_KEYWORDS).map(
  ([basic, keywords]) => [basic, new RegExp(`\\b(${keywords.join("|")})\\b`, "i")],
);

export function basicColor(rawColor) {
  const value = (rawColor ?? "").toLowerCase();
  if (!value) return null;

  for (const [basic, pattern] of BASIC_COLOR_PATTERNS) {
    if (pattern.test(value)) {
      return basic;
    }
  }

  return null;
}
