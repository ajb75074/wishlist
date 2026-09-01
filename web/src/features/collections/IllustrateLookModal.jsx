import { useEffect, useRef, useState } from "react";
import "../../components/modal.css";
import "./IllustrateLookModal.css";
import { AVATAR_SRC } from "./looks";
import { categorizeProduct } from "../../lib/categorize";

// Data-driven so a second style could be added later without touching
// the modal's structure - Milestone 1 only ships the one, per spec.
const ILLUSTRATION_STYLES = [
  {
    key: "y2k-fashion-sketch",
    label: "Y2K Fashion Sketch",
    description:
      "Hand-drawn fashion illustration with elongated proportions, expressive linework, and soft marker/watercolor texture.",
  },
];

// Milestone 1: no AI call yet. This builds and logs the app-level
// generation request that a later milestone will translate into
// whichever image API is chosen - kept deliberately provider-agnostic
// (no Gemini/OpenAI-specific shape) here.
function buildGenerationPayload({ look, pieces, styleKey }) {
  return {
    lookId: look.id,
    avatarImage: AVATAR_SRC,
    pieces: pieces.map((piece) => ({
      id: piece.id,
      // Derived via the app's existing name-keyword heuristic
      // (lib/categorize.js) - wishitems have no stored category column,
      // so this is the project's existing normalized equivalent rather
      // than a new category system.
      category: categorizeProduct(piece),
      imageUrl: piece.cutoutImageUrl ?? piece.imageUrl,
    })),
    style: styleKey,
  };
}

// App only renders this while the modal should be open, so each open
// is a fresh mount - state below starts clean for free, same pattern
// as every other modal in this feature.
function IllustrateLookModal({ look, pieces, onClose }) {
  const [selectedStyle, setSelectedStyle] = useState(ILLUSTRATION_STYLES[0].key);
  const [generationNote, setGenerationNote] = useState("");
  const closeButtonRef = useRef(null);
  // Captured once, at mount - the element that had focus right before
  // this modal opened (the Illustrate Look button), so focus can return
  // there on close instead of being dropped back to <body>.
  const triggerElRef = useRef(document.activeElement);

  useEffect(() => {
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const triggerEl = triggerElRef.current;
    return () => {
      triggerEl?.focus?.();
    };
  }, []);

  // Milestone 1 handler - prepares and logs the app-level payload, does
  // NOT call any AI/image API. Named/shaped so a later milestone can
  // swap this function's body for a real request without touching the
  // modal's UI.
  function handleGenerateIllustration() {
    const payload = buildGenerationPayload({ look, pieces, styleKey: selectedStyle });

    console.log("Illustrate Look - prepared generation payload:", payload);
    setGenerationNote("Generation will be connected in the next milestone.");

    return payload;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal illustrate-look-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="illustrate-look-title"
        aria-describedby="illustrate-look-subtitle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="illustrate-look-modal__header">
          <div>
            <h2 id="illustrate-look-title" className="illustrate-look-modal__title">
              ✧ illustrate look
            </h2>
            <p id="illustrate-look-subtitle" className="illustrate-look-modal__subtitle">
              Turn this look into a fashion illustration.
            </p>
          </div>

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

        <div className="illustrate-look-modal__section">
          <p className="illustrate-look-modal__section-label">model</p>
          <div className="illustrate-look-modal__avatar-frame">
            <img className="illustrate-look-modal__avatar" src={AVATAR_SRC} alt="Your avatar" />
          </div>
        </div>

        <div className="illustrate-look-modal__section">
          <p className="illustrate-look-modal__section-label">your look</p>
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

        {generationNote && <p className="illustrate-look-modal__note">{generationNote}</p>}

        <div className="modal__actions">
          <button type="button" className="modal__button" onClick={onClose}>
            cancel
          </button>

          <button
            type="button"
            className="modal__button modal__button--primary"
            onClick={handleGenerateIllustration}
            disabled={pieces.length === 0}
          >
            generate illustration
          </button>
        </div>
      </div>
    </div>
  );
}

export default IllustrateLookModal;
