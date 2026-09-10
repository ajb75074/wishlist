// Server-side boundary between the app's generation payload and Gemini. The
// API key, prompt, and all image fetching stay here - the client only sends a
// lookId and a style.
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

// Only style and an optional category hint come from the client; every piece
// is derived from the caller's own Look in the database.
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

// Mirrors Look Studio's MAX_BED_PIECES - defense in depth, not a new limit.
const MAX_PIECES = 8;

const MAX_REQUEST_BYTES = 64 * 1024;

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Manual items' user-uploaded photos live here (private bucket) -
// distinct from product-cutouts/look-illustrations, which this
// function never touches.
const ITEM_IMAGES_BUCKET = "item-images";

// The user's optional custom model photo - private bucket, same signed-
// ownership shape as item-images.
const BED_MODEL_IMAGES_BUCKET = "bed-models";

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

// Routed through safeFetch/readBodyWithLimit: SSRF guard, redirect rejection,
// timeout, and response size cap.
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

// Private-bucket objects are paths, not fetchable URLs - read them through
// the caller's own client so RLS enforces ownership, then inline as base64.
async function fetchPrivateImageAsInlineData(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  label: string,
): Promise<InlineImage> {
  const { data, error } = await supabase.storage.from(bucket).download(path);

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

  // Model preferences come from the caller's own profile row, never the
  // request body.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("gender, bed_model_image_path")
    .eq("user_id", authResult.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("illustrate-look: failed to load profile -", profileError);
    return jsonResponse({ error: "Could not load your profile. Please try again." }, 500);
  }

  // Fetched with the caller's own JWT, so RLS does the ownership enforcement
  // - someone else's lookId simply returns nothing.
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

  // supabase-js types embedded relations as arrays without generated DB
  // types; at runtime this is one object per row.
  const placedItems = ((look.look_items ?? []) as unknown as LookItemRow[]).filter(
    (item) => item.is_placed && item.wishitems,
  );

  if (placedItems.length === 0) {
    return jsonResponse({ error: "This Look has no styled pieces yet." }, 400);
  }

  if (placedItems.length > MAX_PIECES) {
    return jsonResponse({ error: `A Look can include at most ${MAX_PIECES} pieces.` }, 400);
  }

  // category is the only field still taken from the client - cosmetic prompt
  // wording only.
  const categoryById = new Map(
    (body.pieces ?? [])
      .filter(
        (piece): piece is { id: string; category: string } =>
          typeof piece?.id === "string" && typeof piece?.category === "string",
      )
      .map((piece) => [piece.id, piece.category]),
  );

  type PieceWithImageSource = Piece & { itemImagePath?: string };

  const pieces: PieceWithImageSource[] = placedItems.map((item) => {
    const wishitem = item.wishitems!;
    const remoteImageUrl = wishitem.cutout_image_url ?? wishitem.image_url ?? undefined;

    return {
      id: wishitem.id,
      name: wishitem.name,
      category: categoryById.get(wishitem.id),
      imageUrl: remoteImageUrl ?? "",
      itemImagePath: remoteImageUrl ? undefined : (wishitem.item_image_path ?? undefined),
    };
  });

  // The style reference is always the local, server-owned asset, never
  // client-supplied.
  let avatarAsset: InlineImage;
  let styleAsset: InlineImage;
  try {
    [avatarAsset, styleAsset] = await Promise.all([
      profile?.bed_model_image_path
        ? fetchPrivateImageAsInlineData(supabase, BED_MODEL_IMAGES_BUCKET, profile.bed_model_image_path, "your photo")
        : readLocalAsset("avatar.png"),
      readLocalAsset(style.assetFile),
    ]);
  } catch (error) {
    console.error("illustrate-look: missing avatar/style asset -", errorMessage(error));
    return jsonResponse(
      {
        error:
          "Illustration generation isn't fully configured yet (missing a local reference image under " +
          "supabase/functions/illustrate-look/assets/).",
      },
      500,
    );
  }

  const sortedPieces = sortPiecesForPrompt(pieces) as PieceWithImageSource[];

  let pieceAssets: InlineImage[];
  try {
    pieceAssets = await Promise.all(
      sortedPieces.map((piece) =>
        piece.itemImagePath
          ? fetchPrivateImageAsInlineData(supabase, ITEM_IMAGES_BUCKET, piece.itemImagePath, piece.name || piece.id)
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
    genderPresentation: profile?.gender ?? undefined,
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
