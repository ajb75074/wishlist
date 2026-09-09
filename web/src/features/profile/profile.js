import { supabase } from "../../lib/supabase";

const PROFILES_TABLE = "profiles";
const PROFILE_IMAGES_BUCKET = "profile-images";
const BED_MODEL_IMAGES_BUCKET = "bed-models";

// Long enough that a normal session doesn't see it expire mid-visit,
// short enough that a copied/leaked link doesn't stay valid forever.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export const ALLOWED_PROFILE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

// A deliberately open set (not a strict binary) - mirrors the
// profiles.gender check constraint exactly. Used by Illustrate Look's
// prompt to describe the illustrated model; "prefer not to say" isn't
// a fourth option in that set, it's just leaving gender unset (null).
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

// `gender` is one of GENDER_OPTIONS' values, or null to clear it
// ("prefer not to say") - both are valid, deliberate states.
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

// The bucket is private, so the stored path alone can't be used as an
// <img src> - every read needs its own fresh signed URL. Returns null
// (rather than throwing) on any failure, since a missing preview image
// should fall back to the default avatar, not break the page.
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

// Always the same fixed key per user (no extension - the private
// bucket is only ever read back via signed URL, whose response carries
// the real Content-Type from upload time, so the path itself doesn't
// need one). "Change photo" is a clean overwrite via upsert, not a
// second file alongside the old one.
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

// Storage removal happens first, then the DB reference is cleared -
// if the DB update fails after Storage succeeds, that's surfaced
// explicitly via `storageRemoved` rather than reported as a plain
// success, so the caller can tell the user to retry instead of the two
// silently disagreeing. (If they don't retry, the stale path still
// self-heals visually: ProfileView's <img onError> falls back to the
// default avatar the next time that now-missing object fails to load.)
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

// The optional custom "model" photo for Look Studio - shown as the
// bed's own avatar (in place of the app's one fixed avatar.png) and,
// server-side, used as Illustrate Look's identity reference. Mirrors
// getProfileImageUrl/uploadProfileImage/removeProfileImage above
// exactly, just against the bed-models bucket/column instead of
// profile-images/profile_image_path - same private-bucket-plus-
// signed-URL reasoning applies (this photo may be of the user
// themselves, so it gets the same privacy treatment).
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
