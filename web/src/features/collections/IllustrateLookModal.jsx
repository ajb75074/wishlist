import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../../components/modal.css";
import "./IllustrateLookModal.css";
import { generateLookIllustration } from "./illustrateLook";
import { categorizeProduct } from "../../lib/categorize";
import { useEscapeKey } from "../../lib/useEscapeKey";
import { ALLOWED_PROFILE_IMAGE_TYPES } from "../profile/profile";

const ILLUSTRATION_STYLES = [
  {
    key: "y2k-fashion-sketch",
    label: "Y2K Fashion Sketch",
    description:
      "Hand-drawn fashion illustration with elongated proportions, expressive linework, and soft marker/watercolor texture.",
  },
];

// No avatar field: the server reads the caller's own profile
// (bed_model_image_path) from the database rather than trusting a
// client-supplied image.
function buildGenerationPayload({ look, pieces, styleKey }) {
  return {
    lookId: look.id,
    pieces: pieces.map((piece) => ({
      id: piece.id,
      name: piece.name,
      // wishitems have no category column, so this uses the app's name-
      // keyword heuristic.
      category: categorizeProduct(piece),
      imageUrl: piece.cutoutImageUrl ?? piece.imageUrl,
    })),
    style: styleKey,
  };
}

// Phase machine - no free-standing Regenerate once a generation succeeds
// (cost control).
function IllustrateLookModal({
  look,
  pieces,
  bedModelImageUrl,
  isUploadingAvatar,
  avatarUploadError,
  onUploadAvatar,
  onClose,
  onSaveIllustration,
}) {
  const [selectedStyle, setSelectedStyle] = useState(ILLUSTRATION_STYLES[0].key);
  const [phase, setPhase] = useState(look.illustrationUrl ? "saved" : "form");
  const [resultImageUrl, setResultImageUrl] = useState(look.illustrationUrl ?? null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const closeButtonRef = useRef(null);
  const isSavingRef = useRef(false);
  // Synchronous guard against a double-click firing two requests before
  // React has re-rendered the disabled button - state alone can't catch
  // that, since setState isn't applied until the next render.
  const isGeneratingRef = useRef(false);
  const triggerElRef = useRef(document.activeElement);
  const avatarFileInputRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, []);

  useEscapeKey(onClose);

  useEffect(() => {
    const triggerEl = triggerElRef.current;
    return () => {
      triggerEl?.focus?.();
    };
  }, []);

  // Avoids setState after unmount if the modal closes mid-request. Reset
  // inside the effect, for StrictMode's double-invoke.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function handleChooseAvatarPhoto() {
    avatarFileInputRef.current?.click();
  }

  async function handleAvatarFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    await onUploadAvatar(file);
  }

  async function handleGenerateIllustration() {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;

    setPhase("generating");
    setErrorMessage("");

    const payload = buildGenerationPayload({ look, pieces, styleKey: selectedStyle });
    const result = await generateLookIllustration(payload);

    isGeneratingRef.current = false;
    if (!isMountedRef.current) return;

    if (result.success) {
      setResultImageUrl(result.imageDataUrl);
      setPhase("result");
    } else {
      setErrorMessage(result.error);
      setPhase("error");
    }
  }

  async function handleSaveIllustration() {
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    setPhase("saving");
    setSaveErrorMessage("");

    const result = await onSaveIllustration(resultImageUrl);

    isSavingRef.current = false;
    if (!isMountedRef.current) return;

    if (result.success) {
      setJustSaved(true);
      setPhase("saved");
    } else {
      setSaveErrorMessage(result.error || "Couldn't save the illustration. Please try again.");
      setPhase("result");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal illustrate-look-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="illustrate-look-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="illustrate-look-modal__header">
          <h2 id="illustrate-look-title" className="illustrate-look-modal__title">
            ✧ Visualize outfit
          </h2>

          <button
            type="button"
            ref={closeButtonRef}
            className="illustrate-look-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {phase === "saved" || phase === "result" || phase === "saving" ? (
          <>
            <div className="illustrate-look-modal__section">
              <div className="illustrate-look-modal__result-frame">
                <img
                  className="illustrate-look-modal__result-image"
                  src={resultImageUrl}
                  alt={`Illustrated version of ${look.name}`}
                />
              </div>
            </div>

            {phase === "saved" && justSaved && (
              <p className="illustrate-look-modal__note illustrate-look-modal__note--success">
                Illustration saved to this outfit.
              </p>
            )}

            {saveErrorMessage && <p className="illustrate-look-modal__note">{saveErrorMessage}</p>}

            <div className="modal__actions">
              <button
                type="button"
                className="modal__button"
                onClick={onClose}
                disabled={phase === "saving"}
              >
                close
              </button>

              {/* Only an unsaved, freshly-generated result gets a Save
                  action - once phase is "saved" (whether from this
                  session or from opening a Look that already has one),
                  Close is the only action, deliberately, per the
                  cost-control spec: no casual regeneration. */}
              {phase !== "saved" && (
                <button
                  type="button"
                  className="modal__button modal__button--primary"
                  onClick={handleSaveIllustration}
                  disabled={phase === "saving"}
                >
                  {phase === "saving" ? "saving..." : "Save illustration"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="illustrate-look-modal__section">
              <p className="illustrate-look-modal__section-label">model</p>
              <div className="illustrate-look-modal__avatar-frame">
                {bedModelImageUrl ? (
                  <img className="illustrate-look-modal__avatar" src={bedModelImageUrl} alt="Your model" />
                ) : (
                  <div className="illustrate-look-modal__avatar-placeholder">
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept={ALLOWED_PROFILE_IMAGE_TYPES.join(",")}
                      onChange={handleAvatarFileSelected}
                      disabled={isUploadingAvatar}
                      hidden
                    />
                    <button
                      type="button"
                      className="illustrate-look-modal__avatar-upload"
                      onClick={handleChooseAvatarPhoto}
                      disabled={isUploadingAvatar}
                    >
                      <span className="illustrate-look-modal__avatar-upload-icon" aria-hidden="true">
                        +
                      </span>
                      <span className="illustrate-look-modal__avatar-upload-label">
                        {isUploadingAvatar ? "uploading…" : "upload model"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
              {avatarUploadError && <p className="illustrate-look-modal__note">{avatarUploadError}</p>}
            </div>

            <div className="illustrate-look-modal__section">
              <p className="illustrate-look-modal__section-label">your outfit</p>
              {pieces.length > 0 ? (
                <div className="illustrate-look-modal__pieces">
                  {pieces.map((piece) => (
                    <div key={piece.id} className="illustrate-look-modal__piece" title={piece.name}>
                      <img
                        src={piece.cutoutImageUrl ?? piece.imageUrl}
                        alt={piece.name}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="illustrate-look-modal__empty">nothing styled on the bed yet</p>
              )}
            </div>

            <div className="illustrate-look-modal__section">
              <p className="illustrate-look-modal__section-label">style</p>
              <div className="illustrate-look-modal__styles" role="radiogroup" aria-label="Illustration style">
                {ILLUSTRATION_STYLES.map((style) => {
                  const isSelected = style.key === selectedStyle;
                  return (
                    <button
                      key={style.key}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`illustrate-look-modal__style-card${isSelected ? " is-selected" : ""}`}
                      onClick={() => setSelectedStyle(style.key)}
                      disabled={phase === "generating"}
                    >
                      <span className="illustrate-look-modal__style-swatch" aria-hidden="true" />
                      <span className="illustrate-look-modal__style-copy">
                        <span className="illustrate-look-modal__style-name">{style.label}</span>
                        <span className="illustrate-look-modal__style-description">{style.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {phase === "error" && <p className="illustrate-look-modal__note">{errorMessage}</p>}

            <p className="illustrate-look-modal__disclosure">
              Visualize uses Google Gemini to process the outfit and reference imagery needed to
              generate your illustration.{" "}
              <Link to="/privacy">Learn more</Link>
            </p>

            {/* No separate Cancel here - the modal's own × already closes
                it, so a second "cancel" button next to Generate was
                redundant. */}
            <div className="modal__actions">
              <button
                type="button"
                className={`modal__button modal__button--primary${phase === "generating" ? " is-generating" : ""}`}
                onClick={handleGenerateIllustration}
                disabled={pieces.length === 0 || !bedModelImageUrl || phase === "generating"}
              >
                {phase === "generating"
                  ? "illustrating your outfit..."
                  : phase === "error"
                    ? "Try again"
                    : "Visualize outfit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default IllustrateLookModal;
