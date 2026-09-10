import { databaseRowToProduct } from "../../lib/productUtils";
import { resolveLookImages } from "../../lib/itemImages";
import { supabase } from "../../lib/supabase";

const LOOKS_TABLE = "looks";
const LOOK_ITEMS_TABLE = "look_items";
const LOOK_ILLUSTRATION_BUCKET = "look-illustrations";

const LOOK_SELECT = "*, look_items(x_position, y_position, scale, is_placed, wishitems(*))";

// position/isPlaced are per-Look, so they're attached per item rather than to
// the shared product shape.
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

// Two calls, no transaction available - best-effort delete the Look if its
// look_items insert fails.
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

// Position is a 0-1 fraction of the bed canvas, not raw pixels, so it stays
// meaningful at any size.
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
