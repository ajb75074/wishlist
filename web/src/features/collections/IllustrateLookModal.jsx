import { useEffect, useRef, useState } from "react";
import "../../components/modal.css";
import "./IllustrateLookModal.css";
import { AVATAR_SRC } from "./looks";
import { generateLookIllustration } from "./illustrateLook";
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

// The app-level generation request. Provider-agnostic on purpose - no
// Gemini-specific shape here, that translation happens entirely
// server-side (supabase/functions/illustrate-look). Note there's no
// avatar field: the server uses its own bundled copy of the one fixed
// avatar image (see that function's own header comment for why), so
// the client has nothing avatar-related to send.
function buildGenerationPayload({ look, pieces, styleKey }) {
  return {
    lookId: look.id,
    pieces: pieces.map((piece) => ({
      id: piece.id,
      name: piece.name,
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
//
// Phase machine (Milestone 3 - cost control means no free-standing
// Regenerate once a generation succeeds):
//   "saved"      - look.illustrationUrl already existed on open, OR a
//                  save just completed. Image + Close only.
//   "form"       - no saved illustration yet; full model/pieces/style
//                  picker, Generate.
//   "generating" - request in flight; same picker, disabled + label.
//   "result"     - a fresh (unsaved) generation succeeded; image +
//                  Close + Save Illustration. No Regenerate - closing
//                  without saving simply discards it (nothing was ever
//                  written to Supabase for it).
//   "saving"     - Save Illustration in flight.
//   "error"      - generation failed; picker still shown (nothing
//                  usable exists yet, so Try Again is fine here).
function IllustrateLookModal({ look, pieces, onClose, onSaveIllustration }) {
  const [selectedStyle, setSelectedStyle] = useState(ILLUSTRATION_STYLES[0].key);
  const [phase, setPhase] = useState(look.illustrationUrl ? "saved" : "form");
  const [resultImageUrl, setResultImageUrl] = useState(look.illustrationUrl ?? null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  // Gates the "Illustration saved to this Look." confirmation line -
  // only true right after an active save in this session, not merely
  // because phase is "saved" (which is also true when reopening a Look
  // that already had one saved from a previous visit).
  const [justSaved, setJustSaved] = useState(false);
  const closeButtonRef = useRef(null);
  // Same synchronous-guard reasoning as isGeneratingRef, for Save.
  const isSavingRef = useRef(false);
  // Synchronous guard against a double-click firing two requests before
  // React has re-rendered the disabled button - state alone can't catch
  // that, since setState isn't applied until the next render.
  const isGeneratingRef = useRef(false);
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

  // Avoids a "set state on an unmounted component" warning if the
  // modal is closed while a generation request is still in flight -
  // the fetch itself isn't aborted (Milestone 2 keeps this simple),
  // its result is just ignored once we're gone. Reset to true at the
  // START of the effect, not just at useRef's initial value - in dev
  // StrictMode, React mounts/unmounts/remounts once on purpose, which
  // runs this cleanup immediately; without resetting it here, the ref
  // would be stuck false for the rest of the component's real life.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Calls the feature service (illustrateLook.js), which calls the
  // illustrate-look Edge Function, which calls Gemini - this component
  // never talks to either directly. Only reachable from "form"/"error"
  // (see the render below) - once a generation succeeds there is no
  // path back to this handler without closing and reopening the modal,
  // which is the whole point of removing Regenerate.
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

  // Uploads the freshly-generated (still unsaved) result via the
  // feature service (CollectionDetailView's onSaveIllustration ->
  // looks.js's saveLookIllustration -> Storage + the Look's own row).
  // A failed save falls back to "result" (not "error") - the generated
  // image is still perfectly good and sitting in memory, so the user
  // can just press Save again without paying for another generation.
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

        {phase === "saved" || phase === "result" || phase === "saving" ? (
          <>
            <div className="illustrate-look-modal__section">
              <p className="illustrate-look-modal__section-label">illustrated look</p>
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
                Illustration saved to this Look.
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
                  {phase === "saving" ? "saving..." : "save illustration"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
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

            {/* No separate Cancel here - the modal's own × already closes
                it, so a second "cancel" button next to Generate was
                redundant. */}
            <div className="modal__actions">
              <button
                type="button"
                className={`modal__button modal__button--primary${phase === "generating" ? " is-generating" : ""}`}
                onClick={handleGenerateIllustration}
                disabled={pieces.length === 0 || phase === "generating"}
              >
                {phase === "generating"
                  ? "illustrating your look..."
                  : phase === "error"
                    ? "try again"
                    : "generate"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default IllustrateLookModal;
