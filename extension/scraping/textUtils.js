const WishlistTextUtils = (() => {
    // Zero-width characters (U+200B/C/D, U+FEFF) that make otherwise-empty
    // text look non-empty.
    const INVISIBLE_CHAR_CODES = [0x200b, 0x200c, 0x200d, 0xfeff];
    const INVISIBLE_CHARS_PATTERN = new RegExp(
        "[" +
            INVISIBLE_CHAR_CODES.map((code) => String.fromCharCode(code)).join("") +
            "]",
        "g"
    );

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
