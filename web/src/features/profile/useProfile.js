import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import {
  ALLOWED_PROFILE_IMAGE_TYPES,
  MAX_PROFILE_IMAGE_BYTES,
  getProfile,
  getProfileImageUrl,
  removeProfileImage,
  updateDisplayName,
  uploadProfileImage,
} from "./profile";

// Owns the Profile page's data + the three mutations it exposes
// (rename, upload photo, remove photo) - same shape as useWishlist:
// the service module (profile.js) only ever talks to Supabase, this
// hook owns loading/error/success state and what the UI can call.
export function useProfile() {
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [profileImagePath, setProfileImagePath] = useState(null);
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadProfile() {
      try {
        const profile = await getProfile(user.id);
        if (!isCurrent) return;

        setDisplayName(profile.displayName);
        setProfileImagePath(profile.profileImagePath);

        const url = await getProfileImageUrl(profile.profileImagePath);
        if (isCurrent) {
          setProfileImageUrl(url);
        }
      } catch {
        if (isCurrent) {
          setErrorMessage("Could not load your profile. Please try refreshing.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isCurrent = false;
    };
  }, [user.id]);

  async function saveDisplayName(nextName) {
    const trimmed = nextName.trim();

    if (!trimmed) {
      setErrorMessage("Display name can't be empty.");
      setSuccessMessage("");
      return { success: false };
    }

    setIsSavingName(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await updateDisplayName(user.id, trimmed);

      if (!result.success) {
        setErrorMessage("Could not save your name. Please try again.");
        return { success: false };
      }

      setDisplayName(trimmed);
      setSuccessMessage("Saved.");
      return { success: true };
    } catch {
      setErrorMessage("Could not save your name. Please try again.");
      return { success: false };
    } finally {
      setIsSavingName(false);
    }
  }

  async function changeProfileImage(file) {
    if (!ALLOWED_PROFILE_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage("Please choose a PNG, JPEG, or WebP image.");
      setSuccessMessage("");
      return { success: false };
    }

    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setErrorMessage("That image is too large - please choose one under 5MB.");
      setSuccessMessage("");
      return { success: false };
    }

    setIsSavingImage(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await uploadProfileImage(user.id, file);

      if (!result.success) {
        setErrorMessage("Could not upload your photo. Please try again.");
        return { success: false };
      }

      setProfileImagePath(result.path);
      setProfileImageUrl(await getProfileImageUrl(result.path));
      setSuccessMessage("Photo updated.");
      return { success: true };
    } catch {
      setErrorMessage("Could not upload your photo. Please try again.");
      return { success: false };
    } finally {
      setIsSavingImage(false);
    }
  }

  async function clearProfileImage() {
    if (!profileImagePath) {
      return { success: false };
    }

    setIsSavingImage(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await removeProfileImage(user.id, profileImagePath);

      if (!result.success) {
        setErrorMessage(
          result.storageRemoved
            ? "Your photo was removed but your profile didn't update - please try again."
            : "Could not remove your photo. Please try again.",
        );
        return { success: false };
      }

      setProfileImagePath(null);
      setProfileImageUrl(null);
      setSuccessMessage("Photo removed.");
      return { success: true };
    } catch {
      setErrorMessage("Could not remove your photo. Please try again.");
      return { success: false };
    } finally {
      setIsSavingImage(false);
    }
  }

  return {
    email: user.email,
    displayName,
    profileImageUrl,
    hasProfileImage: Boolean(profileImagePath),
    isLoading,
    isSavingName,
    isSavingImage,
    errorMessage,
    successMessage,
    saveDisplayName,
    changeProfileImage,
    clearProfileImage,
  };
}
