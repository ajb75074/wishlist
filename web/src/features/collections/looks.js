import { databaseRowToProduct } from "../../lib/productUtils";
import { supabase } from "../../lib/supabase";

const LOOKS_TABLE = "looks";
const LOOK_ITEMS_TABLE = "look_items";

// Nested select pulls each Look's items straight from the join table,
// already resolved to their wishitem rows - same nested-embed pattern
// collections.js uses for collection_items(wishitems(*)). Also pulls
// each look_item's own x/y so the bed canvas can restore a saved
// arrangement instead of always falling back to the deterministic one.
const LOOK_SELECT = "*, look_items(x_position, y_position, wishitems(*))";

// `position` is Look-specific (the same wishitem could sit somewhere
// else in a different Look), so it's attached per-item here rather
// than on the shared product shape from lib/productUtils.
function databaseRowToLook(row) {
  return {
    id: row.id,
    name: row.name,
    collectionId: row.collection_id,
    createdAt: row.created_at,
    wishitems: (row.look_items || [])
      .filter((item) => item.wishitems)
      .map((item) => ({
        ...databaseRowToProduct(item.wishitems),
        position:
          item.x_position != null && item.y_position != null
            ? { x: item.x_position, y: item.y_position }
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

  return data.map(databaseRowToLook);
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

  return data ? databaseRowToLook(data) : null;
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
        })),
      );

    if (itemsError) {
      await supabase.from(LOOKS_TABLE).delete().eq("id", look.id);
      throw itemsError;
    }
  }

  return getLookById(look.id);
}

// Adds wishitems to an existing Look and returns the refreshed Look -
// same "return the fresh row via getLookById" approach createLook uses,
// so callers always get the real post-write shape back.
export async function addItemsToLook(lookId, wishitemIds) {
  if (wishitemIds.length === 0) {
    return getLookById(lookId);
  }

  const { error } = await supabase
    .from(LOOK_ITEMS_TABLE)
    .insert(
      wishitemIds.map((wishitemId) => ({
        look_id: lookId,
        wishitem_id: wishitemId,
      })),
    );

  if (error) {
    throw error;
  }

  return getLookById(lookId);
}

// Removes one wishitem from a Look. Only deletes the look_items
// relationship - the wishitem row itself (and its membership in the
// parent Collection or any other Look) is untouched.
export async function removeItemFromLook(lookId, wishitemId) {
  const { error } = await supabase
    .from(LOOK_ITEMS_TABLE)
    .delete()
    .eq("look_id", lookId)
    .eq("wishitem_id", wishitemId);

  if (error) {
    throw error;
  }

  return getLookById(lookId);
}

// Persists each look_item's canvas position - a 0-1 fraction of the
// bed canvas's own width/height, not raw pixels, so a saved
// arrangement stays meaningful at any canvas size. Upserts by the
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
      positions.map(({ wishitemId, x, y }) => ({
        look_id: lookId,
        wishitem_id: wishitemId,
        x_position: x,
        y_position: y,
      })),
      { onConflict: "look_id,wishitem_id" },
    );

  if (error) {
    throw error;
  }

  return getLookById(lookId);
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
