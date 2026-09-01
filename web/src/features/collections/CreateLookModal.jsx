import { useEffect, useRef, useState } from "react";
import "../../components/modal.css";
import "./CreateLookModal.css";

// App only renders this component while the modal should be open, so
// each open is a fresh mount - form state (just the name now) starts
// clean for free, same pattern as CreateCollectionModal.
// No piece picker anymore - a Look now always starts empty, and the
// user goes straight into Look Studio to style it from their pieces.
function CreateLookModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Escape closes the modal, matching CreateCollectionModal.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const canSubmit = name.trim().length > 0;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const result = await onCreate(name.trim(), []);

    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || "Could not create this look.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal create-look-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-look-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="create-look-modal__header">
          <h2 id="create-look-title" className="modal__title">
            create a look ♡
          </h2>

          <button
            type="button"
            className="create-look-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="create-look-modal__label" htmlFor="look-name">
            give it a name
          </label>

          <input
            id="look-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="dinner in montego bay"
            disabled={isSubmitting}
          />

          <p className="create-look-modal__hint">
            you&rsquo;ll pick pieces for it next, in look studio ♡
          </p>

          {errorMessage && <p className="modal__error">{errorMessage}</p>}

          <div className="modal__actions">
            <button type="button" className="modal__button" onClick={onClose} disabled={isSubmitting}>
              cancel
            </button>

            <button
              type="submit"
              className="modal__button modal__button--primary"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "creating..." : "create look ♡"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateLookModal;
