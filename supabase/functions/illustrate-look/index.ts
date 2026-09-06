// Illustrate Look, Milestone 2 - the server-side boundary between the
// app-level generation payload IllustrateLookModal builds and Gemini's
// image-generation API. Mirrors image-proxy's own pattern (same repo,
// same Deno edge runtime) rather than introducing a new runtime for
// this one feature.
//
// GEMINI_API_KEY lives only here (Deno.env / Supabase Function secrets)
// - it is never read by, or shipped to, the Vite client bundle.
//
// Two fixed local images (the avatar and the one style reference) are
// bundled with this function under ./assets and read straight off
// disk - the web app's own public/ folder has no stable network URL a
// remote edge function could fetch (this project has no public web
// hosting), so those two assets exist here as their own copies rather
// than being fetched.
//
// AUTH + OWNERSHIP: this now requires a real authenticated user
// (requireUser) and loads the Look + its currently placed pieces
// directly from the database using the CALLER's own JWT - table RLS on
// looks/look_items/wishitems does the ownership enforcement, the same
// way it already does everywhere else in this app. The client is no
// longer trusted for piece identity or image URLs at all; only lookId,
// style, and an optional cosmetic category hint are ever read from the
// request body. Per-Look product images (cutout_image_url ??
// image_url) are real Supabase Storage / retailer URLs and are fetched
// here through the SSRF-guarded safeFetch helper, per spec.
import { GoogleGenAI } from "npm:@google/genai@^2.20.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";
import { Buffer } from "node:buffer";
import { buildIllustrationPrompt, sortPiecesForPrompt, type Piece } from "./prompt.ts";
import { requireUser } from "../_shared/auth.ts";
import { MAX_RESPONSE_BYTES, safeFetch, readBodyWithLimit } from "../_shared/urlSafety.ts";

interface InlineImage {
  data: string;
  mimeType: string;
}

interface StyleDefinition {
  label: string;
  description: string;
  assetFile: string;
}

// Only style + an optional per-piece category hint come from the
// client now - id/name/imageUrl for every piece are derived from the
// authenticated user's own Look in the database, never trusted from
// the request body. A client can at most mislabel one of their OWN
// pieces' category (cosmetic prompt wording, not a security boundary)
// - it can no longer supply an arbitrary URL or claim a piece/Look it
// doesn't own.
interface RequestPayload {
  lookId: string;
  style: string;
  pieces?: Array<{ id?: string; category?: string }>;
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

// The request body is now small ({lookId, style, an optional short
// pieces hint array}) - a large Content-Length is itself suspicious,
// and this is checked before req.json() is ever called.
const MAX_REQUEST_BYTES = 64 * 1024;

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Manual items' user-uploaded photos live here (private bucket) -
// distinct from product-cutouts/look-illustrations, which this
// function never touches.
const ITEM_IMAGES_BUCKET = "item-images";

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

// Now routed through safeFetch/readBodyWithLimit (SSRF guard, redirect
// rejection, fetch timeout, response size cap) instead of a bare
// fetch() trusting whatever URL is supplied - the URL itself is now
// always DB-derived (cutout_image_url ?? image_url from the
// authenticated user's own Look), never client-supplied, but it's
// still an external retailer/Storage URL fetched at request time, so
// the same guard applies regardless of where the URL came from.
async function fetchImageAsInlineData(url: string, label: string): Promise<InlineImage> {
  let response: Response;
  try {
    response = await safeFetch(url);
  } catch (error) {
    throw new Error(`Could not fetch the image for "${label}": ${errorMessage(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Could not fetch the image for "${label}".`);
  }

  const mimeType = normalizeMimeType(response.headers.get("content-type")?.split(";")[0]?.trim() ?? "");

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`The image for "${label}" isn't a supported type (png/jpeg/webp).`);
  }

  const bytes = await readBodyWithLimit(response);
  return { data: Buffer.from(bytes).toString("base64"), mimeType };
}

// A manual item's photo lives in the PRIVATE item-images bucket as a
// Storage object path, not a fetchable URL - so unlike the external
// retailer/cutout case above, there's no URL here for safeFetch's
// SSRF guards to apply to in the first place. Rather than generating a
// signed URL and routing it back through safeFetch anyway (safeFetch
// exists specifically to guard fetches to arbitrary, potentially
// attacker-influenced hosts - a concern that doesn't apply to this
// project's own Storage), this downloads the object directly through
// `supabase`, the SAME caller-scoped client requireUser already
// produced. Storage RLS (bucket_id = 'item-images' AND the first path
// segment = auth.uid()) is what actually enforces that this only ever
// succeeds for the caller's own objects - the identical ownership
// model this whole function already relies on for looks/wishitems, no
// service_role involved.
async function fetchPrivateItemImageAsInlineData(
  supabase: SupabaseClient,
  path: string,
  label: string,
): Promise<InlineImage> {
  const { data, error } = await supabase.storage.from(ITEM_IMAGES_BUCKET).download(path);

  if (error || !data) {
    throw new Error(`Could not load the photo for "${label}".`);
  }

  if (data.size > MAX_RESPONSE_BYTES) {
    throw new Error(`The photo for "${label}" is too large.`);
  }

  const mimeType = normalizeMimeType(data.type || "");

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`The photo for "${label}" isn't a supported type (png/jpeg/webp).`);
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  return { data: Buffer.from(bytes).toString("base64"), mimeType };
}

// Returns an error string, or null when the payload is valid. Doesn't
// mutate/coerce `body` - callers still need to narrow its type after a
// null result (see the cast where this is called). Only lookId and
// style are required now - piece identity/URLs come from the database
// (see the handler below), not the request body.
function validatePayload(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object.";
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.lookId !== "string" || !candidate.lookId) {
    return "lookId is required.";
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

  // Rejected before req.json() is ever called - this payload is small,
  // so a large Content-Length is itself suspicious.
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: "Request body is too large." }, 413);
  }

  const authResult = await requireUser(req);
  if (authResult instanceof Response) {
    return authResult;
  }
  const { supabase } = authResult;

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

  // Fetched with the CALLER's own JWT (via requireUser's client above),
  // so table RLS on looks/look_items/wishitems does the ownership
  // enforcement - a lookId belonging to someone else, or that doesn't
  // exist at all, both resolve identically to "not found" below,
  // never distinguishing the two.
  const { data: look, error: lookError } = await supabase
    .from("looks")
    .select("id, look_items(is_placed, wishitems(id, name, image_url, cutout_image_url, item_image_path))")
    .eq("id", body.lookId)
    .maybeSingle();

  if (lookError) {
    console.error("illustrate-look: failed to load look -", lookError);
    return jsonResponse({ error: "Could not load this Look. Please try again." }, 500);
  }

  if (!look) {
    return jsonResponse({ error: "Look not found." }, 404);
  }

  interface LookItemRow {
    is_placed: boolean;
    wishitems: {
      id: string;
      name: string;
      image_url: string | null;
      cutout_image_url: string | null;
      item_image_path: string | null;
    } | null;
  }

  // supabase-js infers embedded relations generically as arrays without
  // generated DB types (which this project doesn't have) - at runtime
  // this is actually one object per row, matching look_items' own
  // UNIQUE(look_id, wishitem_id) constraint and wishitem_id's many-to-one
  // FK. The cast through `unknown` is intentional, not a type-safety
  // shortcut - deno check flagged the mismatch and this is the fix it
  // suggested for exactly this situation.
  const placedItems = ((look.look_items ?? []) as unknown as LookItemRow[]).filter(
    (item) => item.is_placed && item.wishitems,
  );

  if (placedItems.length === 0) {
    return jsonResponse({ error: "This Look has no styled pieces yet." }, 400);
  }

  if (placedItems.length > MAX_PIECES) {
    return jsonResponse({ error: `A Look can include at most ${MAX_PIECES} pieces.` }, 400);
  }

  // category is the one field still allowed from the client - purely
  // cosmetic prompt-wording (prompt.ts already falls back to a generic
  // "PIECE" label for anything missing/unmatched), matched by id
  // against the DB-derived pieces below. A client can only ever
  // mislabel their OWN piece this way, never affect another user or
  // supply a URL/identity.
  const categoryById = new Map(
    (body.pieces ?? [])
      .filter(
        (piece): piece is { id: string; category: string } =>
          typeof piece?.id === "string" && typeof piece?.category === "string",
      )
      .map((piece) => [piece.id, piece.category]),
  );

  // Piece (prompt.ts) declares imageUrl as a plain required string -
  // it's only ever used there for prompt text, never fetched, so this
  // carries itemImagePath alongside it as this file's own addition:
  // the fetch step below needs to tell "private manual photo" apart
  // from "a real image_url/cutout_image_url" without prompt.ts needing
  // to know anything about Storage paths at all.
  type PieceWithImageSource = Piece & { itemImagePath?: string };

  const pieces: PieceWithImageSource[] = placedItems.map((item) => {
    const wishitem = item.wishitems!;
    const remoteImageUrl = wishitem.cutout_image_url ?? wishitem.image_url ?? undefined;

    return {
      id: wishitem.id,
      name: wishitem.name,
      category: categoryById.get(wishitem.id),
      // Never actually fetched when itemImagePath is set below (see
      // the fetch step) - Piece just requires a string, not used for
      // anything but prompt text either way.
      imageUrl: remoteImageUrl ?? "",
      // cutout_image_url (public, already resolved) or a real
      // image_url both take priority exactly as before; the private
      // manual photo is only used when neither exists.
      itemImagePath: remoteImageUrl ? undefined : (wishitem.item_image_path ?? undefined),
    };
  });

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

  // sortPiecesForPrompt's declared return type is Piece[] (it only
  // ever filters/sorts, never reconstructs objects), so the actual
  // PieceWithImageSource instances - and their itemImagePath - are
  // still there at runtime; this cast just tells the type checker
  // what's already true, same intentional-cast pattern already used
  // above for the look_items embed.
  const sortedPieces = sortPiecesForPrompt(pieces) as PieceWithImageSource[];

  let pieceAssets: InlineImage[];
  try {
    pieceAssets = await Promise.all(
      sortedPieces.map((piece) =>
        piece.itemImagePath
          ? fetchPrivateItemImageAsInlineData(supabase, piece.itemImagePath, piece.name || piece.id)
          : fetchImageAsInlineData(piece.imageUrl, piece.name || piece.id),
      ),
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
