import { databaseRowToProduct } from "../../lib/productUtils";
import { supabase } from "../../lib/supabase";

const COLLECTIONS_TABLE = "collections";
const COLLECTION_ITEMS_TABLE = "collection_items";

// Keeps snake_case (image_url) out of the UI - components only ever see imageUrl.
function databaseRowToCollection(row) {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
    color: row.color,
    createdAt: row.created_at,
  };
}

// Returns every collection, newest first.
export async function getCollections() {
  const { data, error } = await supabase
    .from(COLLECTIONS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(databaseRowToCollection);
}

// Returns one collection by id, or null if it doesn't exist.
export async function getCollectionById(collectionId) {
  const { data, error } = await supabase
    .from(COLLECTIONS_TABLE)
    .select("*")
    .eq("id", collectionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? databaseRowToCollection(data) : null;
}

// Creates a new collection. Throws if the name is blank after trimming.
// image_url is optional; color always gets a value (the DB column also
// has its own default, so this is belt-and-suspenders, not the only guard).
export async function createCollection({ name, imageUrl, color }) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Collection name cannot be empty.");
  }

  const { data, error } = await supabase
    .from(COLLECTIONS_TABLE)
    .insert({
      name: trimmedName,
      image_url: imageUrl?.trim() || null,
      color: color || undefined,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return databaseRowToCollection(data);
}

// Renames an existing collection. Throws if the new name is blank after trimming.
export async function renameCollection(collectionId, name) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Collection name cannot be empty.");
  }

  const { data, error } = await supabase
    .from(COLLECTIONS_TABLE)
    .update({ name: trimmedName })
    .eq("id", collectionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return databaseRowToCollection(data);
}

// Deletes a collection. The database's ON DELETE CASCADE removes its
// collection_items rows automatically - we don't need to clean those up here.
export async function deleteCollection(collectionId) {
  const { error } = await supabase
    .from(COLLECTIONS_TABLE)
    .delete()
    .eq("id", collectionId);

  if (error) {
    throw error;
  }

  return { success: true };
}

// Adds a wishlist item to a collection. Upsert + ignoreDuplicates means
// adding an item that's already in the collection is a safe no-op instead
// of an error, without weakening the unique constraint.
export async function addItemToCollection(collectionId, wishitemId) {
  const { data, error } = await supabase
    .from(COLLECTION_ITEMS_TABLE)
    .upsert(
      { collection_id: collectionId, wishitem_id: wishitemId },
      { onConflict: "collection_id,wishitem_id", ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  // data is null when the row already existed and was skipped.
  return { success: true, alreadyExists: data === null, membership: data };
}

// Removes a wishlist item from one collection only - it stays in any
// other collections it belongs to, and the wishlist item itself is untouched.
export async function removeItemFromCollection(collectionId, wishitemId) {
  const { error } = await supabase
    .from(COLLECTION_ITEMS_TABLE)
    .delete()
    .eq("collection_id", collectionId)
    .eq("wishitem_id", wishitemId);

  if (error) {
    throw error;
  }

  return { success: true };
}

// Returns the actual wishlist products in a collection, already normalized
// into the same product shape the rest of the app (ProductCard/ProductGrid) uses.
export async function getCollectionItems(collectionId) {
  const { data, error } = await supabase
    .from(COLLECTION_ITEMS_TABLE)
    .select("wishitems(*)")
    .eq("collection_id", collectionId);

  if (error) {
    throw error;
  }

  return data
    .map((row) => row.wishitems)
    .filter(Boolean)
    .map(databaseRowToProduct);
}

// Returns the collections a given wishlist item currently belongs to.
// Useful for an "Add to Collection" checklist UI.
export async function getCollectionsForItem(wishitemId) {
  const { data, error } = await supabase
    .from(COLLECTION_ITEMS_TABLE)
    .select("collections(*)")
    .eq("wishitem_id", wishitemId);

  if (error) {
    throw error;
  }

  return data
    .map((row) => row.collections)
    .filter(Boolean)
    .map(databaseRowToCollection);
}
