import { databaseRowToProduct, productToDatabaseRow } from "./productUtils";
import { supabase } from "./supabase";

const WISHLIST_TABLE = "wishitems";

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
