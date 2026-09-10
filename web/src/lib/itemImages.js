import { supabase } from "./supabase";

const ITEM_IMAGES_BUCKET = "item-images";

// Long enough a normal session doesn't see it expire mid-visit, short
// enough a leaked link doesn't stay valid forever. Shared with
// profile.js, the only other place that signs a private Storage URL.
export const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

// Given item-images Storage paths, returns a Map from path -> signed
// URL. A path that fails to sign is simply absent, not thrown - "no
// usable image" is already a normal, tolerated case for callers.
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

export async function resolveItemImages(products) {
  const paths = products.filter((product) => product.itemImagePath).map((product) => product.itemImagePath);
  const signedUrlByPath = await getSignedUrlMap(paths);

  return products.map((product) =>
    product.itemImagePath && signedUrlByPath.has(product.itemImagePath)
      ? { ...product, imageUrl: signedUrlByPath.get(product.itemImagePath) }
      : product,
  );
}

// Applied by PATH, not wishitem id - the same item can appear in several
// Looks with different per-look fields.
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
