// Illustrate Look, Milestone 2 - the server-side boundary between the
// app-level generation payload IllustrateLookModal builds and Gemini's
// image-generation API. Mirrors image-proxy's own pattern (same repo,
// same Deno edge runtime, same anon-key auth) rather than introducing
// a new runtime for this one feature.
//
// GEMINI_API_KEY lives only here (Deno.env / Supabase Function secrets)
// - it is never read by, or shipped to, the Vite client bundle.
//
// Two fixed local images (the avatar and the one style reference) are
// bundled with this function under ./assets and read straight off
// disk - the web app's own public/ folder has no stable network URL a
// remote edge function could fetch (this project has no public web
// hosting), so those two assets exist here as their own copies rather
// than being fetched. Per-Look product images (cutoutImageUrl ??
// imageUrl) are real Supabase Storage / retailer URLs and ARE fetched
// here, per spec.
import { GoogleGenAI } from "npm:@google/genai@^2.20.0";
import { Buffer } from "node:buffer";
import { buildIllustrationPrompt, sortPiecesForPrompt, type Piece } from "./prompt.ts";

interface InlineImage {
  data: string;
  mimeType: string;
}

interface StyleDefinition {
  label: string;
  description: string;
  assetFile: string;
}

interface RequestPayload {
  lookId: string;
  pieces: Piece[];
  style: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mirrors Look Studio's own MAX_BED_PIECES (LookDetailView.jsx) - the
// bed can never hold more than 8 pieces anyway, so this is a
// defense-in-depth check, not a new arbitrary number. Total reference
// images sent to Gemini = 1 avatar + up to 8 pieces + 1 style = 10,
// still comfortably under current Gemini image models' supported
// reference-image count. Keep this in sync with the client constant -
// otherwise a fully-styled Look could fail Illustrate Look outright.
const MAX_PIECES = 8;

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// The one style Milestone 1 shipped in the modal - keyed by the same
// `style` id the client already sends. Adding a second style later is
// just another entry here (asset + label + description); the client
// never supplies the description or the reference image itself.
const STYLES: Record<string, StyleDefinition> = {
  "y2k-fashion-sketch": {
    label: "Y2K Fashion Sketch",
    description:
      "Hand-drawn fashion illustration with elongated proportions, expressive linework, and soft marker/watercolor texture.",
    assetFile: "y2k-fashion-sketch.png",
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function normalizeMimeType(mimeType: string): string {
  if (mimeType === "image/jpg") return "image/jpeg";
  return mimeType;
}

async function readLocalAsset(fileName: string): Promise<InlineImage> {
  const bytes = await Deno.readFile(new URL(`./assets/${fileName}`, import.meta.url));
  return { data: Buffer.from(bytes).toString("base64"), mimeType: "image/png" };
}

// Server-side fetch, per spec - keeps the Gemini key and request
// construction centralized, and the client payload is just a URL.
async function fetchImageAsInlineData(url: string, label: string): Promise<InlineImage> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`Could not fetch the image for "${label}".`);
  }

  if (!response.ok) {
    throw new Error(`Could not fetch the image for "${label}".`);
  }

  const mimeType = normalizeMimeType(response.headers.get("content-type")?.split(";")[0]?.trim() ?? "");

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`The image for "${label}" isn't a supported type (png/jpeg/webp).`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return { data: Buffer.from(bytes).toString("base64"), mimeType };
}

// Returns an error string, or null when the payload is valid. Doesn't
// mutate/coerce `body` - callers still need to narrow its type after a
// null result (see the cast where this is called).
function validatePayload(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object.";
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.lookId !== "string" || !candidate.lookId) {
    return "lookId is required.";
  }

  if (!Array.isArray(candidate.pieces) || candidate.pieces.length === 0) {
    return "At least one styled piece is required.";
  }

  if (candidate.pieces.length > MAX_PIECES) {
    return `A Look can include at most ${MAX_PIECES} pieces.`;
  }

  for (const piece of candidate.pieces) {
    if (
      !piece ||
      typeof piece !== "object" ||
      typeof (piece as Record<string, unknown>).id !== "string" ||
      typeof (piece as Record<string, unknown>).imageUrl !== "string" ||
      !(piece as Record<string, unknown>).imageUrl
    ) {
      return "Each piece needs an id and imageUrl.";
    }
  }

  if (typeof candidate.style !== "string" || !STYLES[candidate.style]) {
    return "Unsupported style.";
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    // Deliberately generic to the client but unambiguous in the
    // function's own logs - never echoes the (absent) key itself.
    console.error("illustrate-look: GEMINI_API_KEY is not configured.");
    return jsonResponse({ error: "Illustration generation isn't configured yet." }, 500);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const validationError = validatePayload(rawBody);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const body = rawBody as RequestPayload;
  const style = STYLES[body.style];

  // Local, server-owned assets - never fetched over the network, never
  // supplied by the client (see the file header comment).
  let avatarAsset: InlineImage;
  let styleAsset: InlineImage;
  try {
    [avatarAsset, styleAsset] = await Promise.all([
      readLocalAsset("avatar.png"),
      readLocalAsset(style.assetFile),
    ]);
  } catch (error) {
    console.error("illustrate-look: missing local asset -", errorMessage(error));
    return jsonResponse(
      {
        error:
          "Illustration generation isn't fully configured yet (missing a local reference image under " +
          "supabase/functions/illustrate-look/assets/).",
      },
      500,
    );
  }

  const sortedPieces = sortPiecesForPrompt(body.pieces);

  let pieceAssets: InlineImage[];
  try {
    pieceAssets = await Promise.all(
      sortedPieces.map((piece) => fetchImageAsInlineData(piece.imageUrl, piece.name || piece.id)),
    );
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 502);
  }

  const promptText = buildIllustrationPrompt({
    pieces: sortedPieces,
    styleLabel: style.label,
    styleDescription: style.description,
  });

  const contents = [
    { text: promptText },
    { inlineData: avatarAsset },
    ...pieceAssets.map((asset) => ({ inlineData: asset })),
    { inlineData: styleAsset },
  ];

  const ai = new GoogleGenAI({ apiKey });

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "3:4" },
      },
    });
  } catch (error) {
    console.error("illustrate-look: Gemini request failed -", error);
    return jsonResponse({ error: "Image generation failed. Please try again." }, 502);
  }

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData);
  const inlineData = imagePart?.inlineData;

  if (!inlineData?.data || !inlineData?.mimeType) {
    console.error("illustrate-look: Gemini returned no image part.", {
      textParts: parts.filter((part) => part.text).map((part) => part.text),
    });
    return jsonResponse({ error: "The model didn't return an image. Please try again." }, 502);
  }

  return jsonResponse({
    imageDataUrl: `data:${inlineData.mimeType};base64,${inlineData.data}`,
  });
});
