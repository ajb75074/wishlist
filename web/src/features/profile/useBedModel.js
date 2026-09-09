import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import {
  ALLOWED_PROFILE_IMAGE_TYPES,
  MAX_PROFILE_IMAGE_BYTES,
  getBedModelImageUrl,
  getProfile,
  uploadBedModelImage,
} from "./profile";

// Read-only-plus-upload, single-purpose sibling of useProfile - Look
// Studio (the bed itself, and Illustrate Look's "model" preview) only
// ever needs to know what photo to show in place of the default
// avatar, and - now that the bed itself offers an inline "upload
// selfie" placeholder when none is set - a way to upload one directly
// from there without routing to the full Profile page. Kept as its own
// hook rather than reusing useProfile so those two components don't
// pull in display-name/password state they have nothing to do with.
export function useBedModel() {
  const { user } = useAuth();

  const [bedModelImageUrl, setBedModelImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      try {
        const profile = await getProfile(user.id);
        const url = await getBedModelImageUrl(profile.bedModelImagePath);
        if (isCurrent) {
          setBedModelImageUrl(url);
        }
      } catch {
        // A failed lookup just falls back to the default avatar below -
        // this isn't important enough to surface as an error state on
        // top of Look Studio's own UI.
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isCurrent = false;
    };
  }, [user.id]);

  async function changeBedModelImage(file) {
    if (!ALLOWED_PROFILE_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Please choose a PNG, JPEG, or WebP image.");
      return { success: false };
    }

    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setUploadError("That image is too large - please choose one under 5MB.");
      return { success: false };
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const result = await uploadBedModelImage(user.id, file);

      if (!result.success) {
        setUploadError("Could not upload your photo. Please try again.");
        return { success: false };
      }

      setBedModelImageUrl(await getBedModelImageUrl(result.path));
      return { success: true };
    } catch {
      setUploadError("Could not upload your photo. Please try again.");
      return { success: false };
    } finally {
      setIsUploading(false);
    }
  }

  return {
    bedModelImageUrl,
    hasBedModelImage: Boolean(bedModelImageUrl),
    isLoading,
    isUploading,
    uploadError,
    changeBedModelImage,
  };
}
