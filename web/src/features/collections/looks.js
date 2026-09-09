import { databaseRowToProduct } from "../../lib/productUtils";
import { resolveLookImages } from "../../lib/itemImages";
import { supabase } from "../../lib/supabase";

const LOOKS_TABLE = "looks";
const LOOK_ITEMS_TABLE = "look_items";
const LOOK_ILLUSTRATION_BUCKET = "look-illustrations";

// Nested select pulls each Look's items straight from the join table,
// already resolved to their wishitem rows - same nested-embed pattern
// collections.js uses for collection_items(wishitems(*)). Also pulls
// each look_item's own x/y/scale/is_placed so the bed canvas can
// restore a saved arrangement instead of always falling back to the
// deterministic one.
const LOOK_SELECT = "*, look_items(x_position, y_position, scale, is_placed, wishitems(*))";

// `position`/`isPlaced` are Look-specific (the same wishitem could sit
// somewhere else, or not be placed at all, in a different Look), so
// they're attached per-item here rather than on the shared product
// shape from lib/productUtils. scale is optional even when x/y are
// present - older rows saved before scale existed simply have it null,
// which falls back to normal size (1x).
function databaseRowToLook(row) {
  return {
    id: row.id,
    name: row.name,
    collectionId: row.collection_id,
    createdAt: row.created_at,
    illustrationUrl: row.illustration_url,
    wishitems: (row.look_items || [])
      .filter((item) => item.wishitems)
      .map((item) => ({
        ...databaseRowToProduct(item.wishitems),
        isPlaced: item.is_placed,
        position:
          item.x_position != null && item.y_position != null
            ? { x: item.x_position, y: item.y_position, scale: item.scale }
            : null,
      })),
  };
}

// Returns every Look in a collection, newest first.
export async function getLooksForCollection(collectionId) {
  const { data, error } = await supabase
    .from(LOOKS_TABLE)
    .select(LOOK_SELECT)
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return resolveLookImages(data.map(databaseRowToLook));
}

// Returns one Look by id, or null if it doesn't exist.
export async function getLookById(lookId) {
  const { data, error } = await supabase
    .from(LOOKS_TABLE)
    .select(LOOK_SELECT)
    .eq("id", lookId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [look] = await resolveLookImages([databaseRowToLook(data)]);
  return look;
}

// Creates a Look and its look_items in two client-side calls, since this
// frontend-only Supabase setup has no way to run them in one real
// transaction. If the look_items insert fails, we best-effort delete the
// Look we just created rather than leaving a permanent empty orphan -
// this is a cleanup attempt, not a guarantee (e.g. a dropped connection
// between the two calls can still leave an empty Look behind).
export async function createLook(collectionId, name, wishitemIds = []) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Look name cannot be empty.");
  }

  const { data: look, error: createError } = await supabase
    .from(LOOKS_TABLE)
    .insert({ collection_id: collectionId, name: trimmedName })
    .select()
    .single();

  if (createError) {
    throw createError;
  }

  if (wishitemIds.length > 0) {
    const { error: itemsError } = await supabase
      .from(LOOK_ITEMS_TABLE)
      .insert(
        wishitemIds.map((wishitemId) => ({
          look_id: look.id,
          wishitem_id: wishitemId,
          is_placed: false,
        })),
      );

    if (itemsError) {
      await supabase.from(LOOKS_TABLE).delete().eq("id", look.id);
      throw itemsError;
    }
  }

  return getLookById(look.id);
}

// Persists each look_item's canvas position, size, AND placement -
// position as a 0-1 fraction of the bed canvas's own width/height (not
// raw pixels) so a saved arrangement stays meaningful at any canvas
// size, scale as the same multiplier the resize toolbar already
// adjusts (1 = normal size), and isPlaced as whether it should render
// on the bed at all. Entries may omit x/y/scale entirely (used when a
// piece is being taken OFF the bed - its old position is deliberately
// left alone in the database, so it reappears where it was last time
// it's placed again, rather than being cleared). Upserts by the
// existing UNIQUE(look_id, wishitem_id) constraint (same approach
// collections.js's addItemToCollection uses) rather than looping
// individual updates, so moving several pieces is still one round trip.
export async function updateLookLayout(lookId, positions) {
  if (positions.length === 0) {
    return getLookById(lookId);
  }

  const { error } = await supabase
    .from(LOOK_ITEMS_TABLE)
    .upsert(
      positions.map(({ wishitemId, x, y, scale, isPlaced }) => {
        const row = { look_id: lookId, wishitem_id: wishitemId };
        if (isPlaced !== undefined) row.is_placed = isPlaced;
        if (x !== undefined) row.x_position = x;
        if (y !== undefined) row.y_position = y;
        if (scale !== undefined) row.scale = scale;
        return row;
      }),
      { onConflict: "look_id,wishitem_id" },
    );

  if (error) {
    throw error;
  }

  return getLookById(lookId);
}

// Persists a Milestone 2 generation result (a temporary data: URL held
// only in IllustrateLookModal's own state) as this Look's one saved
// illustration - Milestone 3 deliberately supports zero-or-one per
// Look, no history/versions. Mirrors wishlist.js's uploadPieceCutout +
// updateWishitemCutoutImage pair (upload, then point the row at the
// result), the only other place this app touches Supabase Storage:
// same stable-path-plus-upsert approach (re-saving overwrites the same
// object rather than accumulating orphans) and the same cache-busting
// `?v=` suffix so the browser doesn't keep showing a stale image after
// a re-save.
export async function saveLookIllustration(lookId, imageDataUrl) {
  let blob;
  try {
    blob = await (await fetch(imageDataUrl)).blob();
  } catch {
    return { success: false, error: "Couldn't process the generated image. Please try again." };
  }

  const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${lookId}/illustration.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(LOOK_ILLUSTRATION_BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type });

  if (uploadError) {
    return { success: false, error: "Couldn't upload the illustration. Please try again." };
  }

  const { data } = supabase.storage.from(LOOK_ILLUSTRATION_BUCKET).getPublicUrl(path);
  const illustrationUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabase
    .from(LOOKS_TABLE)
    .update({ illustration_url: illustrationUrl })
    .eq("id", lookId);

  if (dbError) {
    // The upload succeeded but the Look was never pointed at it - clean
    // up the now-orphaned object rather than leaving dangling state in
    // Storage that nothing references.
    await supabase.storage.from(LOOK_ILLUSTRATION_BUCKET).remove([path]);
    return { success: false, error: "Couldn't save the illustration to this Look. Please try again." };
  }

  return { success: true, illustrationUrl };
}

// Deletes a Look. The database's ON DELETE CASCADE removes its
// look_items rows automatically - the wishitems themselves are a
// separate table and are never touched.
export async function deleteLook(lookId) {
  const { error } = await supabase
    .from(LOOKS_TABLE)
    .delete()
    .eq("id", lookId);

  if (error) {
    throw error;
  }

  return { success: true };
}
