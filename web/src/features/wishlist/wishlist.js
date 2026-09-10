import { databaseRowToProduct, productToDatabaseRow } from "../../lib/productUtils";
import { resolveItemImages } from "../../lib/itemImages";
import { supabase } from "../../lib/supabase";

const WISHLIST_TABLE = "wishitems";
const CUTOUT_BUCKET = "product-cutouts";
const ITEM_IMAGES_BUCKET = "item-images";

export const ALLOWED_ITEM_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_ITEM_IMAGE_BYTES = 5 * 1024 * 1024;

export async function getWishlistItems() {
  const { data, error } = await supabase
    .from(WISHLIST_TABLE)
    .select("*")
    .order("date_saved", { ascending: false });

  if (error) {
    throw error;
  }

  return resolveItemImages(data.map(databaseRowToProduct));
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

  const [enrichedProduct] = await resolveItemImages([databaseRowToProduct(data)]);
  return { success: true, product: enrichedProduct };
}

// Only these fields are user-editable. Anything else in `updates` is ignored.
export async function updateWishlistItem(id, updates) {
  const row = {
    color: updates.color || null,
    size: updates.size || null,
    price: updates.price ?? null,
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

  // Callers replace the product's entire object with this result, so the
  // signed image URL has to be re-resolved or a manual item's photo reverts
  // to null on every edit.
  const [product] = await resolveItemImages([databaseRowToProduct(data)]);
  return { success: true, product };
}

// Callers must generate the wishitem id client-side and upload BEFORE
// inserting the row, so item_image_path is set at insert time. Clean up the
// upload with removeItemImage if that insert then fails.
export async function uploadItemImage(userId, wishitemId, file) {
  const path = `${userId}/${wishitemId}/photo`;

  const { error } = await supabase.storage
    .from(ITEM_IMAGES_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    return { success: false, error };
  }

  return { success: true, path };
}

export async function removeItemImage(path) {
  try {
    await supabase.storage.from(ITEM_IMAGES_BUCKET).remove([path]);
  } catch {
    // Best-effort cleanup on an already-failing path - nothing useful to do.
  }
}

export async function updateWishitemImagePath(id, itemImagePath) {
  const { data, error } = await supabase
    .from(WISHLIST_TABLE)
    .update({ item_image_path: itemImagePath })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { success: false, error };
  }

  const [product] = await resolveItemImages([databaseRowToProduct(data)]);
  return { success: true, product };
}

export async function uploadPieceCutout(wishitemId, blob) {
  const path = `${wishitemId}/cutout.png`;

  const { error } = await supabase.storage
    .from(CUTOUT_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "image/png" });

  if (error) {
    return { success: false, error };
  }

  const { data } = supabase.storage.from(CUTOUT_BUCKET).getPublicUrl(path);

  // The path is stable across re-saves, so bust the cache or a stale cutout
  // keeps being served.
  return { success: true, url: `${data.publicUrl}?v=${Date.now()}` };
}

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

// Fallback for retailer images served without CORS headers: image-proxy
// fetches them server-side, where CORS doesn't apply.
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
