import { useEffect, useRef, useState } from "react";
import "../../components/modal.css";
import "./CreateLookModal.css";

// App only renders this component while the modal should be open, so
// each open is a fresh mount - form state (name, selection) starts
// clean for free, same pattern as CreateCollectionModal.
// `pieces` is the Collection's own already-loaded wishitems (from
// CollectionDetailView's Pieces state) - no separate fetch here.
function CreateLookModal({ pieces, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
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

  function toggleSelected(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const canSubmit = name.trim().length > 0 && selectedIds.size > 0;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const result = await onCreate(name.trim(), Array.from(selectedIds));

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

          <div className="create-look-modal__pieces-section">
            <span className="create-look-modal__label">choose your pieces</span>

            <div
              className="create-look-modal__pieces-grid"
              role="group"
              aria-label="Choose pieces for this look"
            >
              {pieces.map((piece) => {
                const isSelected = selectedIds.has(piece.id);

                return (
                  <button
                    key={piece.id}
                    type="button"
                    className={`create-look-modal__piece${isSelected ? " is-selected" : ""}`}
                    onClick={() => toggleSelected(piece.id)}
                    aria-pressed={isSelected}
                    disabled={isSubmitting}
                  >
                    <img
                      className="create-look-modal__piece-image"
                      src={piece.imageUrl}
                      alt={piece.name}
                    />

                    <span className="create-look-modal__piece-name">
                      {piece.name}
                    </span>

                    {isSelected && (
                      <span className="create-look-modal__piece-check" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="create-look-modal__count">
              {selectedIds.size} {selectedIds.size === 1 ? "piece" : "pieces"} selected
            </p>
          </div>

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
