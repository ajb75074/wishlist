// Small shared helper for cleaning text read back out of the live page.
// Used by extractGenericProduct.js wherever DOM text is checked for
// emptiness or parsed as a price - kept separate since it's a plain
// string utility with no DOM-query or JSON-LD knowledge of its own.
const WishlistTextUtils = (() => {
    // Zero Width Space (U+200B), Zero Width Non-Joiner (U+200C), Zero
    // Width Joiner (U+200D), Zero Width No-Break Space (U+FEFF) -
    // invisible characters that can sit inside otherwise-normal-looking
    // text (e.g. a dollar sign followed by a zero-width non-joiner
    // before the digits) and silently break emptiness checks and price
    // parsing without being visible to a human looking at the page.
    // Built from numeric code points at runtime, deliberately, rather
    // than written as literal characters or \u escapes in this source
    // file - keeps the file itself free of any invisible byte a diff
    // or editor could silently mangle.
    const INVISIBLE_CHAR_CODES = [0x200b, 0x200c, 0x200d, 0xfeff];
    const INVISIBLE_CHARS_PATTERN = new RegExp(
        "[" +
            INVISIBLE_CHAR_CODES.map((code) => String.fromCharCode(code)).join("") +
            "]",
        "g"
    );

    // Never mutates the page - only ever applied to a string this
    // extraction pipeline has already read out of the DOM.
    function cleanScrapedText(value) {
        if (typeof value !== "string") {
            return "";
        }

        return value
            .replace(INVISIBLE_CHARS_PATTERN, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    return {
        cleanScrapedText,
    };
})();
