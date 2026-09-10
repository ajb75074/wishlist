import { supabase } from "../../lib/supabase";
import { SIGNED_URL_EXPIRY_SECONDS } from "../../lib/itemImages";

const PROFILES_TABLE = "profiles";
const PROFILE_IMAGES_BUCKET = "profile-images";
const BED_MODEL_IMAGES_BUCKET = "bed-models";

export const ALLOWED_PROFILE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

// Mirrors the profiles.gender check constraint - a deliberately open set, not
// a strict binary.
export const GENDER_OPTIONS = [
  { value: "feminine", label: "Feminine" },
  { value: "masculine", label: "Masculine" },
  { value: "androgynous", label: "Androgynous" },
];

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("display_name, profile_image_path, gender, bed_model_image_path")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return {
    displayName: data.display_name ?? "",
    profileImagePath: data.profile_image_path,
    gender: data.gender,
    bedModelImagePath: data.bed_model_image_path,
  };
}

export async function updateDisplayName(userId, displayName) {
  const { error } = await supabase
    .from(PROFILES_TABLE)
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) {
    return { success: false, error };
  }

  return { success: true };
}

export async function updateGender(userId, gender) {
  const { error } = await supabase
    .from(PROFILES_TABLE)
    .update({ gender, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) {
    return { success: false, error };
  }

  return { success: true };
}

// Private bucket, so the stored path can't be used as an <img src> - every
// read needs a fresh signed URL. Returns null rather than throwing.
export async function getProfileImageUrl(path) {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

// Fixed key per user, no extension - the signed-URL response already
// carries the real Content-Type. Upsert makes "change photo" a clean
// overwrite, not a second file.
export async function uploadProfileImage(userId, file) {
  const path = `${userId}/profile`;

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { success: false, error: uploadError };
  }

  const { error: dbError } = await supabase
    .from(PROFILES_TABLE)
    .update({ profile_image_path: path, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (dbError) {
    return { success: false, error: dbError };
  }

  return { success: true, path };
}

// Storage removal happens first, then the DB reference - if the DB
// update then fails, that's surfaced via `storageRemoved` so the
// caller can prompt a retry instead of the two silently disagreeing.
export async function removeProfileImage(userId, path) {
  const { error: removeError } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .remove([path]);

  if (removeError) {
    return { success: false, error: removeError };
  }

  const { error: dbError } = await supabase
    .from(PROFILES_TABLE)
    .update({ profile_image_path: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (dbError) {
    return { success: false, error: dbError, storageRemoved: true };
  }

  return { success: true };
}

export async function getBedModelImageUrl(path) {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(BED_MODEL_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    return null;
  }

  return data.signedUrl;
}

export async function uploadBedModelImage(userId, file) {
  const path = `${userId}/bed-model`;

  const { error: uploadError } = await supabase.storage
    .from(BED_MODEL_IMAGES_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { success: false, error: uploadError };
  }

  const { error: dbError } = await supabase
    .from(PROFILES_TABLE)
    .update({ bed_model_image_path: path, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (dbError) {
    return { success: false, error: dbError };
  }

  return { success: true, path };
}

export async function removeBedModelImage(userId, path) {
  const { error: removeError } = await supabase.storage
    .from(BED_MODEL_IMAGES_BUCKET)
    .remove([path]);

  if (removeError) {
    return { success: false, error: removeError };
  }

  const { error: dbError } = await supabase
    .from(PROFILES_TABLE)
    .update({ bed_model_image_path: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (dbError) {
    return { success: false, error: dbError, storageRemoved: true };
  }

  return { success: true };
}
