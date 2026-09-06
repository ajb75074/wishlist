import { databaseRowToProduct, productToDatabaseRow } from "../../lib/productUtils";
import { resolveItemImages } from "../../lib/itemImages";
import { supabase } from "../../lib/supabase";

const WISHLIST_TABLE = "wishitems";
const CUTOUT_BUCKET = "product-cutouts";
const ITEM_IMAGES_BUCKET = "item-images";

// Manual Add's accepted types/size limit - deliberately duplicated
// from profile.js's identical constants rather than imported from it:
// three shared primitive values don't justify a cross-feature
// dependency between profile/ and wishlist/, and these are free to
// diverge later without that coupling.
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

// See this file's own header note on creation order (below
// uploadItemImage) for how a manual item's id/itemImagePath end up on
// `product` before this is ever called. Extension-created items never
// set either, so productToDatabaseRow drops both from the insert and
// the usual gen_random_uuid()/null defaults apply - this function's
// own behavior for that case is completely unchanged.
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

  // App.jsx/CollectionDetailView's onUpdate handlers replace a
  // product's ENTIRE object with whatever this returns - without
  // re-resolving here, a manual item's signed imageUrl would silently
  // revert to null (its own image_url is always null) the moment its
  // color/size was edited.
  const [product] = await resolveItemImages([databaseRowToProduct(data)]);
  return { success: true, product };
}

// Manual item photo upload for the item-images bucket (private -
// distinct from product-cutouts/look-illustrations, which are public).
// Mirrors profile.js's uploadProfileImage almost exactly: a fixed,
// extensionless path per owner (here per wishitem, not per user, since
// one user has many items) - the private bucket is only ever read back
// via signed URL (see lib/itemImages.js), whose response carries the
// real Content-Type from upload time, so the path itself doesn't need
// one. "Change photo" later is a clean overwrite via upsert, not a
// second file alongside the old one.
//
// CREATION ORDER (what Phase 3 should call, and in what order):
// item_image_path can't be set on a wishitem row until the row's own
// id exists, but naming this path *after* the row is created risks an
// orphaned photo-less row if the upload or the follow-up update then
// fails. Instead, generate the wishitem id client-side first
// (crypto.randomUUID() - the id column accepts an explicit value at
// insert time, falling back to its own gen_random_uuid() default only
// when omitted, exactly as every extension-created row already does):
//   1. const id = crypto.randomUUID()
//   2. const { path } = await uploadItemImage(userId, id, file)
//   3. await saveWishlistItem({ ...formFields, id, itemImagePath: path })
//   4. if step 3 fails, best-effort clean up the now-orphaned upload:
//      supabase.storage.from('item-images').remove([path])
// This mirrors looks.js's saveLookIllustration, which cleans up its
// own upload the same way if the DB step that should reference it
// fails - by the time a wishitem row is ever visible to a query, it
// already has its photo, rather than existing photo-less in between.
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

// Best-effort cleanup for an item-images object that was uploaded but
// never (or no longer) ends up referenced by a wishitem row - e.g. the
// insert that was supposed to point at it failed. Errors are
// swallowed rather than thrown: this is already the failure-recovery
// path, so a caller catching a cleanup failure on top of the original
// failure has nothing further/better to do than the same "please try
// again" message it's already showing.
export async function removeItemImage(path) {
  try {
    await supabase.storage.from(ITEM_IMAGES_BUCKET).remove([path]);
  } catch {
    // Best-effort only - see above.
  }
}

// Only item_image_path is writable here - same explicit allow-list
// approach updateWishlistItem/updateWishitemCutoutImage already use.
// Not needed by the creation flow above (item_image_path is set at
// INSERT time via saveWishlistItem) - this exists for a later "change
// photo on an existing item" flow, mirroring
// removeProfileImage/uploadProfileImage's update-in-place pattern.
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


