import { databaseRowToProduct } from "../../lib/productUtils";
import { supabase } from "../../lib/supabase";

const LOOKS_TABLE = "looks";
const LOOK_ITEMS_TABLE = "look_items";

// Nested select pulls each Look's items straight from the join table,
// already resolved to their wishitem rows - same nested-embed pattern
// collections.js uses for collection_items(wishitems(*)).
const LOOK_SELECT = "*, look_items(wishitems(*))";

function databaseRowToLook(row) {
  return {
    id: row.id,
    name: row.name,
    collectionId: row.collection_id,
    createdAt: row.created_at,
    wishitems: (row.look_items || [])
      .map((item) => item.wishitems)
      .filter(Boolean)
      .map(databaseRowToProduct),
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
