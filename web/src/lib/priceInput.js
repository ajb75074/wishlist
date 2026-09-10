// Non-negative decimal, optionally with a leading $ and thousands separators;
// anything else is rejected rather than silently coerced.
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

export function parsePriceInput(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { valid: true, value: null };
  }

  const cleaned = trimmed.replace(/^\$/, "").replace(/,/g, "");

  if (!PRICE_PATTERN.test(cleaned)) {
    return { valid: false };
  }

  return { valid: true, value: Number(cleaned) };
}
