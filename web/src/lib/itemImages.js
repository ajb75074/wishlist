import { supabase } from "./supabase";

const ITEM_IMAGES_BUCKET = "item-images";

// Matches profile.js's own convention - long enough that a normal
// session doesn't see it expire mid-visit, short enough that a
// copied/leaked link doesn't stay valid forever. No existing
// architecture suggests a different duration is warranted here.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

// Shared low-level primitive: given a set of item-images Storage
// paths, returns a Map from path -> signed URL. A path that fails to
// sign (or the whole batch call failing) is simply absent from the
// map rather than thrown - callers already treat "no usable image"
// as a normal, tolerated case (same as a missing retailer image_url
// today), not an error. Every higher-level helper below shares this
// one implementation so the actual batch-signing call only exists once.
async function getSignedUrlMap(paths) {
  const uniquePaths = [...new Set(paths)];
  const map = new Map();

  if (uniquePaths.length === 0) {
    return map;
  }

  const { data, error } = await supabase.storage
    .from(ITEM_IMAGES_BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    return map;
  }

  for (const entry of data) {
    if (!entry.error && entry.signedUrl) {
      map.set(entry.path, entry.signedUrl);
    }
  }

  return map;
}

// For a flat list of products (getWishlistItems/getCollectionItems -
// each wishitem appears at most once): batches every itemImagePath
// into a single signed-url request instead of one per item, then
// applies the results back onto each product's own imageUrl. A
// product with no itemImagePath, or whose path didn't resolve, is
// returned unchanged - it keeps whatever image_url already gave it
// (usually null for a manual item), the same "missing image" case
// every consumer (ProductCard, etc.) already tolerates.
//
// This is the data/service boundary the resolution is meant to happen
// at - call this once per fetched list, not per rendered component.
export async function resolveItemImages(products) {
  const paths = products.filter((product) => product.itemImagePath).map((product) => product.itemImagePath);
  const signedUrlByPath = await getSignedUrlMap(paths);

  return products.map((product) =>
    product.itemImagePath && signedUrlByPath.has(product.itemImagePath)
      ? { ...product, imageUrl: signedUrlByPath.get(product.itemImagePath) }
      : product,
  );
}

// Looks-specific: the SAME wishitem can appear in more than one Look
// within a collection, each with its own isPlaced/position - resolving
// by product identity (like resolveItemImages does, via a Map keyed
// on id) would collapse those separate per-look copies onto whichever
// one happened to be seen last. This instead batches every unique path
// across every Look in ONE request, then applies results back onto
// each look's own wishitems array by PATH rather than by wishitem id -
// so per-look fields are always preserved untouched, and pieces
// repeated across looks still only cost one signed-url each.
export async function resolveLookImages(looks) {
  const allPaths = looks.flatMap((look) =>
    look.wishitems.filter((piece) => piece.itemImagePath).map((piece) => piece.itemImagePath),
  );
  const signedUrlByPath = await getSignedUrlMap(allPaths);

  return looks.map((look) => ({
    ...look,
    wishitems: look.wishitems.map((piece) =>
      piece.itemImagePath && signedUrlByPath.has(piece.itemImagePath)
        ? { ...piece, imageUrl: signedUrlByPath.get(piece.itemImagePath) }
        : piece,
    ),
  }));
}
