import { databaseRowToProduct, productToDatabaseRow } from "../../lib/productUtils";
import { supabase } from "../../lib/supabase";

const WISHLIST_TABLE = "wishitems";
const CUTOUT_BUCKET = "product-cutouts";

export async function getWishlistItems() {
  const { data, error } = await supabase
    .from(WISHLIST_TABLE)
    .select("*")
    .order("date_saved", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(databaseRowToProduct);
}

export async function saveWishlistItem(product) {
  const { data, error } = await supabase
    .from(WISHLIST_TABLE)
    .insert(productToDatabaseRow(product))
    .select()
    .single();

  if (error?.code === "23505") {
    return { success: false, duplicate: true };
  }

  if (error) {
    throw error;
  }

  return { success: true, product: databaseRowToProduct(data) };
}

// Only these fields are user-editable. Anything else passed in `updates` is ignored.
export async function updateWishlistItem(id, updates) {
  const row = {
    color: updates.color || null,
    size: updates.size || null,
  };

  const { data, error } = await supabase
    .from(WISHLIST_TABLE)
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { success: false, error };
  }

  return { success: true, product: databaseRowToProduct(data) };
}

// Uploads a Prepare Piece cutout to a single stable path per item
// (upsert: true), so re-preparing a piece overwrites the same Storage
// object instead of leaving old versions behind. The object path never
// changes across re-saves, so a cache-busting query string is appended
// to the URL actually stored/displayed - otherwise the browser (or a
// CDN) could keep showing a stale cached image after a re-save.
export async function uploadPieceCutout(wishitemId, blob) {
  const path = `${wishitemId}/cutout.png`;

  const { error } = await supabase.storage
    .from(CUTOUT_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "image/png" });

  if (error) {
    return { success: false, error };
  }

  const { data } = supabase.storage.from(CUTOUT_BUCKET).getPublicUrl(path);

  return { success: true, url: `${data.publicUrl}?v=${Date.now()}` };
}

// Only cutout_image_url is writable here - same explicit allow-list
// approach updateWishlistItem already uses for color/size.
export async function updateWishitemCutoutImage(id, cutoutImageUrl) {
  const { data, error } = await supabase
    .from(WISHLIST_TABLE)
    .update({ cutout_image_url: cutoutImageUrl })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { success: false, error };
  }

  return { success: true, product: databaseRowToProduct(data) };
}

// Prepare Piece's fallback for a retailer image whose own server sends
// no CORS headers (segmentation.js's direct fetchImageAsBlob fails
// first, then this is tried). Routes the request through the
// image-proxy Edge Function, which fetches the image server-side (CORS
// is a browser-only restriction, not a server-to-server one) and
// re-serves the same bytes with permissive CORS headers attached.
//
// Authorization is now the signed-in user's own access_token, not the
// publishable key - the function requires a real authenticated user
// (it fetches arbitrary URLs server-side, so the publishable key alone
// is no longer sufficient). The publishable key stays in `apikey`,
// which Supabase's gateway still expects on every request. No
// service-role key involved.
export async function fetchProductImageViaProxy(url) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("SIGN_IN_REQUIRED");
  }

  const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;

  const response = await fetch(proxyUrl, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    throw new Error("IMAGE_FETCH_FAILED");
  }

  return response.blob();
}

export async function deleteWishlistItem(id) {
  const { error } = await supabase
    .from(WISHLIST_TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    return { success: false, error };
  }

  return { success: true };
}


