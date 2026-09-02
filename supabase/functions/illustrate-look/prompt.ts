// Builds the actual Gemini prompt text - kept entirely server-side (see
// index.ts) so the client can never inject/override the real
// instructions Gemini receives. The client only ever supplies a
// `style` ID and Look/piece metadata; this file owns the wording.

export interface Piece {
  id: string;
  name?: string;
  category?: string;
  imageUrl: string;
}

// Same broad grouping Look Studio's own catalog filter uses
// (LookDetailView.jsx's matchesFilter/CATALOG_FILTERS) - reused here so
// "top/bottom/shoes/bag" ordering matches what the app already treats
// as those buckets, rather than inventing a second categorization.
const CATEGORY_RANK: Record<string, number> = {
  Tops: 1,
  Dresses: 1,
  Bottoms: 2,
  Shoes: 3,
  Bags: 4,
  Accessories: 4,
};

const CATEGORY_LABEL: Record<string, string> = {
  Tops: "TOP",
  Dresses: "TOP",
  Bottoms: "BOTTOM",
  Shoes: "SHOES",
  Bags: "BAG",
  Accessories: "ACCESSORY",
};

// Stable sort - ties (including pieces with no/unknown category) keep
// their original Look order rather than being reshuffled.
export function sortPiecesForPrompt(pieces: Piece[]): Piece[] {
  return pieces
    .map((piece, index) => ({ piece, index }))
    .sort((a, b) => {
      const rankA = CATEGORY_RANK[a.piece.category ?? ""] ?? 5;
      const rankB = CATEGORY_RANK[b.piece.category ?? ""] ?? 5;
      if (rankA !== rankB) return rankA - rankB;
      return a.index - b.index;
    })
    .map(({ piece }) => piece);
}

function labelForPiece(piece: Piece): string {
  return CATEGORY_LABEL[piece.category ?? ""] ?? "PIECE";
}

// pieces must already be sorted (see sortPiecesForPrompt) - this only
// renders the reference list, it doesn't re-order anything.
export function buildIllustrationPrompt({
  pieces,
  styleLabel,
  styleDescription,
}: {
  pieces: Piece[];
  styleLabel: string;
  styleDescription: string;
}): string {
  const pieceLines = pieces
    .map((piece, index) => {
      // Reference 1 is always the avatar (see index.ts), so pieces start at 2.
      const referenceNumber = index + 2;
      const name = piece.name?.trim() || `Piece ${index + 1}`;
      return `REFERENCE ${referenceNumber} — ${labelForPiece(piece)} — "${name}"`;
    })
    .join("\n");

  const styleReferenceNumber = pieces.length + 2;

  return `Create ONE full-body fashion illustration using the supplied visual references.

REFERENCE ROLES

REFERENCE 1 = CHARACTER / AVATAR

This determines WHO is illustrated.

Preserve:
- recognizable facial characteristics
- complexion / skin tone
- hairstyle
- hair texture
- hair color
- overall recognizable appearance

Do not preserve the original pose.
Do not preserve the avatar's original rendering style.
The avatar should be reinterpreted as a fashion illustration.

OUTFIT REFERENCES

The following references determine WHAT the character wears.

${pieceLines}

Each reference above is identified by product name/category. Treat the
fashion-product references as authoritative.

Preserve as closely as possible:
- colors
- graphics
- patterns
- logos
- patches
- silhouettes
- proportions
- shoe shape/color blocking
- bag shape/hardware
- accessory design

Do not replace pieces with similar products.
Do not invent unrelated garments.
Do not omit pieces unless physically necessary for a coherent outfit.

STYLE REFERENCE

REFERENCE ${styleReferenceNumber} — STYLE — "${styleLabel}"

${styleDescription}

The final supplied style reference determines HOW the output is drawn.

Use it for:
- illustration proportions
- line quality
- marker/pencil/watercolor rendering
- overall Y2K fashion illustration aesthetic

DO NOT copy the person, identity, clothing, or exact pose from the style reference. DO NOT use the signature, watermark, handwriting, or any other identifying marks from the style reference. The style reference is only for the illustration style, not for the subject or outfit.

WHO = avatar
WHAT = fashion piece references
HOW = style reference

ILLUSTRATION

Create:
- ONE character
- entire body visible from head through shoes
- confident fashion-illustration pose
- elongated stylized fashion proportions
- expressive hand-drawn linework
- stylized but recognizable face
- detailed illustrated hair
- marker / pencil / watercolor texture
- subtle painted shading
- polished fashion-design illustration
- portrait-oriented composition

The result should be intentionally illustrated.

Do NOT make it photorealistic.
Do NOT make it look like a photograph with a sketch filter.
Do NOT add additional people.
Do NOT add unrelated fashion pieces.

Use a restrained pale blush / warm ivory background with subtle sketchbook texture or marks.

PRIORITY:
1. preserve avatar identity
2. preserve outfit references
3. show full outfit clearly
4. match fashion illustration aesthetic`;
}
