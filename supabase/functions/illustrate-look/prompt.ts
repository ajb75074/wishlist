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

// Mirrors the profiles.gender check constraint (see the
// bed_model_and_gender migration) - a deliberately open set, not a
// strict binary. Each gets its own pose-selection guidance below
// (POSE_GUIDANCE_BY_GENDER); an unrecognized/absent value falls back to
// NEUTRAL_POSE_GUIDANCE instead of guessing.

// Applies regardless of which (if any) gender-specific guidance is
// used below - shared so all four paths give Gemini the same baseline
// requirements instead of three near-duplicates plus one shorter one.
const POSE_PRIORITY = `POSE PRIORITY

Regardless of gender/presentation:
1. Show the outfit clearly.
2. Keep the full body visible.
3. Avoid hands covering important garment details.
4. Keep accessories visible.
5. Avoid awkward anatomy.
6. Keep the pose natural.
7. Vary poses between generated outfits when possible.

Do not make every generated visualization use an identical pose.`;

const POSE_GUIDANCE_BY_GENDER: Record<string, string> = {
  feminine: `Choose naturally from poses such as:
- one hand resting lightly at the waist or hip
- one leg slightly forward with relaxed weight shift
- gentle contrapposto stance
- relaxed arms with one hand holding the handbag
- subtle three-quarter fashion stance
- one knee slightly bent
- natural runway-inspired standing pose

The pose can feel elegant and feminine without becoming exaggerated.

Avoid extreme hip popping or overly sexualized posing unless the source styling specifically calls for it.`,
  masculine: `Do NOT default to the feminine hand-on-hip pose.

Prefer poses such as:
- relaxed straight stance with arms naturally at the sides
- one hand casually in a trouser or jacket pocket
- both hands loosely near or inside pockets
- relaxed three-quarter stance
- one foot slightly forward
- shoulders relaxed with weight shifted naturally onto one leg
- lightly adjusting a jacket, cuff, or sleeve when appropriate
- holding a bag naturally at the side when the outfit includes one

The pose should feel like a contemporary men's fashion editorial rather than a stiff catalog mannequin.

Avoid automatically placing one hand dramatically on the hip.`,
  androgynous: `Use a more neutral editorial pose.

Good options include:
- relaxed asymmetrical stance
- one hand in pocket
- arms naturally resting at sides
- slight weight shift
- one foot forward
- subtle three-quarter stance
- casually holding an accessory
- relaxed runway/editorial posture

Avoid forcing strongly gender-coded posing in either direction.`,
};

// No gender preference set - stay neutral rather than guessing, unlike
// the three named presentations above which each get their own menu.
const NEUTRAL_POSE_GUIDANCE = `Choose a natural, editorial fashion pose that shows the outfit clearly without forcing a strongly gender-coded stance in either direction.`;

function buildPoseSection(genderPresentation?: string): string {
  const guidance = (genderPresentation && POSE_GUIDANCE_BY_GENDER[genderPresentation]) || NEUTRAL_POSE_GUIDANCE;

  return `POSE SELECTION

Do NOT automatically use the same pose for every model.

Choose a natural fashion-editorial pose appropriate to the selected model presentation.

The pose should show the clothing clearly and should not obscure important garment details.

${guidance}

${POSE_PRIORITY}`;
}

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
  genderPresentation,
}: {
  pieces: Piece[];
  styleLabel: string;
  styleDescription: string;
  // Optional - one of profiles.gender's own values ("feminine" /
  // "masculine" / "androgynous"), or omitted/unrecognized when the
  // user hasn't set a preference. Only ever drives POSE SELECTION
  // below; every "preserve the model's real appearance" instruction is
  // unchanged and still wins for everything else (face, skin tone,
  // hair, body proportions).
  genderPresentation?: string;
}): string {
  const pieceLines = pieces
    .map((piece, index) => {
      // Reference 1 is always the model photo (see index.ts), so pieces start at 2.
      const referenceNumber = index + 2;
      const name = piece.name?.trim() || `Piece ${index + 1}`;
      return `REFERENCE ${referenceNumber} — ${labelForPiece(piece)} — "${name}"`;
    })
    .join("\n");

  const styleReferenceNumber = pieces.length + 2;

  return `Create a polished full-body fashion illustration of the model shown in REFERENCE 1 wearing the exact outfit assembled by the user (REFERENCE 2 onward), using the supplied visual references.

The purpose of this image is to help the user visualize how all selected clothing and accessories work together as one complete outfit.

REFERENCE ROLES

REFERENCE 1 = MODEL

Use this as the identity/reference for the person.

Preserve the model's important visual characteristics from the reference, including:
- skin tone
- general facial features
- hair color
- hairstyle / texture
- approximate body proportions

Do not beautify the model into a completely different person.

Do not preserve the reference photo's original pose or its original rendering style (photo vs. illustration) - the model should be reinterpreted as a fashion illustration. The result should feel like an illustrated fashion version of the selected model.

OUTFIT REFERENCES — VERY IMPORTANT

The following references determine WHAT the character wears. Recreate this outfit as accurately as possible - the outfit is the priority.

${pieceLines}

Each reference above is identified by product name/category. Treat the
fashion-product references as authoritative.

Preserve recognizable details of each selected item as closely as possible, including:
- silhouette
- neckline
- sleeve length
- garment length
- fit
- material appearance
- pattern
- color
- footwear
- jewelry
- handbag
- belt
- accessories

Do not randomly replace clothing with similar fashion items.
Do not add garments that were not selected.
Do not omit pieces unless physically necessary for a coherent outfit.
If accessories are included, place them naturally on the model whenever possible.

${buildPoseSection(genderPresentation)}

STYLE REFERENCE

REFERENCE ${styleReferenceNumber} — STYLE — "${styleLabel}"

${styleDescription}

The final supplied style reference informs HOW the output is drawn (illustration proportions, line quality, rendering texture) - but it is always subordinate to the ILLUSTRATION STYLE requirements below, which take priority whenever the two could conflict (e.g. if the style reference itself reads as a photographed notebook page, do NOT reproduce that - follow "ABSOLUTELY NO NOTEBOOK ELEMENTS" instead).

DO NOT copy the person, identity, clothing, or exact pose from the style reference. DO NOT use the signature, watermark, handwriting, or any other identifying marks from the style reference. The style reference is only for the illustration style, not for the subject or outfit.

WHO = model reference
WHAT = fashion piece references
HOW = style reference, bounded by ILLUSTRATION STYLE below

ILLUSTRATION STYLE

Create a sophisticated fashion-sketch / fashion-editorial illustration. It should reference the feeling of classic fashion illustration and fashion design sketches while still rendering the actual garments clearly enough for outfit visualization.

Use:
- elegant illustrated linework
- subtle texture
- watercolor strokes/accents
- soft painted shadows
- softly rendered skin
- fashion-sketch detailing
- lightly imperfect analog-feeling edges
- refined proportions
- tasteful editorial finish

It can feel hand-rendered without literally looking like it was drawn on a notebook page.

Do NOT make it:
- photorealistic
- anime
- cartoonish
- childish
- chibi
- 3D rendered
- glossy AI fantasy art
- fully abstract/painterly (watercolor strokes and soft shadows are welcome as accents, not the whole rendering)
- unfinished scribble art

The finished result should feel suitable for a modern fashion archive or digital dress-up application.

BACKGROUND

Use a clean, simple warm ivory or off-white background. The background should be nearly empty so the model and outfit remain the focus. A very subtle paper texture is acceptable, but it must look like a clean finished illustration surface - NOT a photographed sketchbook or notebook.

ABSOLUTELY NO NOTEBOOK ELEMENTS

This is extremely important. Do NOT generate: notebook spiral binding, notebook rings, notebook prongs, binder rings, punched holes, perforated paper, torn notebook edges, ruled notebook lines, graph paper, sketchbook binding, visible book edges, or page corners suggesting the illustration is inside a notebook. The image should be the artwork itself, NOT a physical notebook containing the artwork.

ABSOLUTELY NO TEXT OR SIGNATURES

Do NOT include any text anywhere in the generated image - no artist signatures, initials, handwritten signatures, handwriting, captions, outfit names, labels, dates, annotations, arrows, fashion notes, fake designer names, watermarks, logos added by the illustration, decorative words, scribbled writing, or illegible pseudo-text. Do not sign the artwork or place a signature in a bottom corner. There should be ZERO handwritten marks that resemble language or a signature. Decorative sketch lines are allowed only when they clearly belong to the illustration itself and cannot be mistaken for handwriting.

COMPOSITION

Generate ONE model only, shown from head to toe. Keep entire hairstyle visible, entire outfit visible, shoes fully visible, handbags/accessories visible, and comfortable negative space around the body. Do not crop the head, hair, hands, shoes, or handbags. Keep the figure centered or slightly editorially offset while maintaining enough breathing room around the silhouette. Portrait-oriented composition.

FINAL OUTPUT REQUIREMENT

The result should look like a clean standalone fashion illustration exported from a fashion sketchbook - NOT a photograph of a page inside a sketchbook.

The final image should contain ONLY: the illustrated model, the user's outfit, selected accessories, a clean neutral background, and subtle legitimate illustration texture. No signature. No handwriting. No text. No notebook prongs. No spiral binding. No punched holes. No notebook edges. No decorative labels. No extra people. No unselected clothing.

PRIORITY:
1. preserve model identity
2. preserve outfit references (accuracy is the priority)
3. show full outfit clearly
4. natural, gender-appropriate, varied pose selection
5. clean fashion-editorial finish with zero notebook/text/signature elements`;
}
