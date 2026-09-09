// Shared between App.jsx (actual filtering) and FilterPopover.jsx
// (rendering the checkboxes) so the ranges themselves - and their
// boundaries - only live in one place, same pattern as categorize.js
// and basicColor.js.
export const PRICE_RANGES = [
  { key: "under-50", label: "Under $50", test: (price) => price < 50 },
  { key: "50-100", label: "$50 – $100", test: (price) => price >= 50 && price < 100 },
  { key: "100-200", label: "$100 – $200", test: (price) => price >= 100 && price < 200 },
  { key: "200-plus", label: "$200+", test: (price) => price >= 200 },
];

export function priceMatchesRanges(price, rangeKeys) {
  if (rangeKeys.length === 0) return true;

  const numericPrice = Number(price) || 0;
  return rangeKeys.some((key) => {
    const range = PRICE_RANGES.find((r) => r.key === key);
    return range?.test(numericPrice);
  });
}
