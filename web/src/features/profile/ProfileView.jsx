import { useRef, useState } from "react";
import { ALLOWED_PROFILE_IMAGE_TYPES } from "./profile";
import { useProfile } from "./useProfile";
import "./ProfileView.css";

// Plain geometric placeholder - functional-only like the rest of this
// screen, not a design asset. Deliberately unrelated to Look Studio's
// dress-up avatar image, which lives entirely under features/collections.
function DefaultAvatar() {
  return (
    <svg viewBox="0 0 64 64" className="profile-view__avatar-fallback" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#2a2a33" />
      <circle cx="32" cy="25" r="12" fill="#6b6b78" />
      <path d="M10 58c3-14 15-22 22-22s19 8 22 22" fill="#6b6b78" />
    </svg>
  );
}

function ProfileView() {
  const {
    email,
    displayName,
    profileImageUrl,
    hasProfileImage,
    isLoading,
    isSavingName,
    isSavingImage,
    errorMessage,
    successMessage,
    saveDisplayName,
    changeProfileImage,
    clearProfileImage,
  } = useProfile();

  const [nameDraft, setNameDraft] = useState("");
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const fileInputRef = useRef(null);

  // Same "resync on source change" trick CollectionThumbnail already
  // uses for its own image-fallback state: keeps the editable draft in
  // step with whatever profile.js last loaded/saved, without a
  // setState-in-effect.
  const [lastDisplayName, setLastDisplayName] = useState(null);
  if (displayName !== lastDisplayName) {
    setLastDisplayName(displayName);
    setNameDraft(displayName);
  }

  async function handleSaveName(event) {
    event.preventDefault();
    await saveDisplayName(nameDraft);
  }

  function handleChoosePhoto() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0];
    // Clears the input so choosing the same file again still fires a
    // change event.
    event.target.value = "";
    if (!file) return;

    setImageLoadFailed(false);
    await changeProfileImage(file);
  }

  if (isLoading) {
    return (
      <div className="profile-view">
        <p>Loading...</p>
      </div>
    );
  }

  const showImage = Boolean(profileImageUrl) && !imageLoadFailed;

  return (
    <div className="profile-view">
      <h1 className="profile-view__title">Profile</h1>

      <div className="profile-view__avatar-row">
        <div className="profile-view__avatar">
          {showImage ? (
            <img src={profileImageUrl} alt="" onError={() => setImageLoadFailed(true)} />
          ) : (
            <DefaultAvatar />
          )}
        </div>

        <div className="profile-view__avatar-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_PROFILE_IMAGE_TYPES.join(",")}
            onChange={handleFileSelected}
            disabled={isSavingImage}
            hidden
          />

          <button type="button" onClick={handleChoosePhoto} disabled={isSavingImage}>
            {isSavingImage ? "saving..." : hasProfileImage ? "change photo" : "upload photo"}
          </button>

          {hasProfileImage && (
            <button
              type="button"
              className="profile-view__remove-photo"
              onClick={clearProfileImage}
              disabled={isSavingImage}
            >
              remove photo
            </button>
          )}
        </div>
      </div>

      <form className="profile-view__form" onSubmit={handleSaveName}>
        <label className="profile-view__label" htmlFor="profile-display-name">
          display name
        </label>
        <input
          id="profile-display-name"
          type="text"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          disabled={isSavingName}
        />

        <label className="profile-view__label" htmlFor="profile-email">
          email
        </label>
        <input id="profile-email" type="email" value={email} disabled readOnly />

        {errorMessage && <p className="profile-view__error">{errorMessage}</p>}
        {successMessage && <p className="profile-view__success">{successMessage}</p>}

        <button type="submit" className="profile-view__save" disabled={isSavingName}>
          {isSavingName ? "saving..." : "save"}
        </button>
      </form>
    </div>
  );
}

export default ProfileView;
