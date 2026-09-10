import { useRef, useState } from "react";
import ChangePasswordModal from "./ChangePasswordModal";
import { ALLOWED_PROFILE_IMAGE_TYPES, GENDER_OPTIONS } from "./profile";
import { useProfile } from "./useProfile";
import { useAuth } from "../../lib/useAuth";
import keyIcon from "../../assets/key.png";
import "./ProfileView.css";

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
  const { signOut } = useAuth();
  const {
    email,
    displayName,
    profileImageUrl,
    hasProfileImage,
    gender,
    bedModelImageUrl,
    hasBedModelImage,
    isLoading,
    isSavingName,
    isSavingImage,
    isSavingGender,
    isSavingBedModelImage,
    errorMessage,
    successMessage,
    saveDisplayName,
    changeProfileImage,
    clearProfileImage,
    saveGender,
    changeBedModelImage,
    clearBedModelImage,
  } = useProfile();

  const [nameDraft, setNameDraft] = useState("");
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [bedModelImageLoadFailed, setBedModelImageLoadFailed] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const fileInputRef = useRef(null);
  const bedModelFileInputRef = useRef(null);

  // Resync the draft when the loaded profile changes, without a setState-in-
  // effect.
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

  function handleChooseBedModelPhoto() {
    bedModelFileInputRef.current?.click();
  }

  async function handleBedModelFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBedModelImageLoadFailed(false);
    await changeBedModelImage(file);
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

      <div className="profile-view__grid">
        <section className="profile-view__panel profile-view__panel--profile">
          <h2 className="profile-view__panel-title">Profile</h2>

          <div className="profile-view__avatar-row">
            <div className="profile-view__avatar">
              {showImage ? (
                <img src={profileImageUrl} alt="Your profile photo" onError={() => setImageLoadFailed(true)} />
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

              <button
                type="button"
                className="profile-view__upload"
                onClick={handleChoosePhoto}
                disabled={isSavingImage}
              >
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
            <div className="profile-view__field-group">
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
            </div>

            <div className="profile-view__field-group">
              <label className="profile-view__label" htmlFor="profile-email">
                email
              </label>
              <input id="profile-email" type="email" value={email} disabled readOnly />
            </div>

            {errorMessage && <p className="profile-view__error">{errorMessage}</p>}
            {successMessage && <p className="profile-view__success">{successMessage}</p>}

            <button type="submit" className="profile-view__save" disabled={isSavingName}>
              {isSavingName ? "saving..." : "save"}
            </button>
          </form>
        </section>

        <div className="profile-view__side">
          <section className="profile-view__panel profile-view__panel--model">
            <h2 className="profile-view__panel-title">Look Studio model</h2>

            <div className="profile-view__avatar-row">
              <div className="profile-view__avatar">
                {bedModelImageUrl && !bedModelImageLoadFailed ? (
                  <img src={bedModelImageUrl} alt="Your Look Studio model photo" onError={() => setBedModelImageLoadFailed(true)} />
                ) : (
                  <DefaultAvatar />
                )}
              </div>

              <div className="profile-view__avatar-actions">
                <input
                  ref={bedModelFileInputRef}
                  type="file"
                  accept={ALLOWED_PROFILE_IMAGE_TYPES.join(",")}
                  onChange={handleBedModelFileSelected}
                  disabled={isSavingBedModelImage}
                  hidden
                />

                <button
                  type="button"
                  className="profile-view__upload"
                  onClick={handleChooseBedModelPhoto}
                  disabled={isSavingBedModelImage}
                >
                  {isSavingBedModelImage ? "saving..." : hasBedModelImage ? "change photo" : "upload photo"}
                </button>

                {hasBedModelImage && (
                  <button
                    type="button"
                    className="profile-view__remove-photo"
                    onClick={clearBedModelImage}
                    disabled={isSavingBedModelImage}
                  >
                    remove photo
                  </button>
                )}
              </div>
            </div>

            <div className="profile-view__field-group">
              <label className="profile-view__label">gender</label>
              <div className="profile-view__gender-options" role="radiogroup" aria-label="Model gender">
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={gender === option.value}
                    className={`profile-view__gender-option${gender === option.value ? " is-selected" : ""}`}
                    onClick={() => saveGender(option.value)}
                    disabled={isSavingGender}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="profile-view__panel profile-view__panel--account">
            <h2 className="profile-view__panel-title">Account</h2>

            <button
              type="button"
              className="profile-view__account-row"
              onClick={() => setIsChangePasswordOpen(true)}
            >
              <span>change password</span>
              <span className="profile-view__account-row-chevron" aria-hidden="true">
                ›
              </span>
            </button>

            {/* Same signOut() the Sidebar's own "Sign out" button already
                calls (useAuth) - surfaced here too rather than a new
                capability, since Account is the more expected home for it. */}
            <button type="button" className="profile-view__account-row" onClick={signOut}>
              <span>sign out</span>
              <span className="profile-view__account-row-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </section>
        </div>
      </div>

      <div className="profile-view__key">
        <img src={keyIcon} alt="" aria-hidden="true" />
      </div>

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}

export default ProfileView;
