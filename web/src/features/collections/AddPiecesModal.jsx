import { useEffect, useRef, useState } from "react";
import "../../components/modal.css";
import "./AddPiecesModal.css";

// Fresh mount each time it's open, same as CreateLookModal - form
// state (the new selection) starts clean for free.
// `collectionPieces` is the parent Collection's already-loaded
// wishitems (CollectionDetailView's own `products`) - no separate fetch.
// `existingWishitemIds` marks pieces already in this Look so they
// render selected+disabled instead of being pickable again.
function AddPiecesModal({
  collectionName,
  collectionPieces,
  existingWishitemIds,
  onClose,
  onAdd,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const closeButtonRef = useRef(null);

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

  const canSubmit = selectedIds.size > 0;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const result = await onAdd(Array.from(selectedIds));

    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || "Could not add those pieces.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal add-pieces-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-pieces-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="add-pieces-modal__header">
          <div>
            <h2 id="add-pieces-title" className="modal__title">
              add pieces ♡
            </h2>
            <p className="add-pieces-modal__subtitle">from {collectionName}</p>
          </div>

          <button
            type="button"
            ref={closeButtonRef}
            className="add-pieces-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {collectionPieces.length === 0 ? (
            <p className="add-pieces-modal__empty">
              no pieces in {collectionName} yet
            </p>
          ) : (
            <div
              className="add-pieces-modal__grid"
              role="group"
              aria-label="Choose pieces to add"
            >
              {collectionPieces.map((piece) => {
                const alreadyAdded = existingWishitemIds.has(piece.id);
                const isSelected = alreadyAdded || selectedIds.has(piece.id);

                return (
                  <button
                    key={piece.id}
                    type="button"
                    className={`add-pieces-modal__piece${isSelected ? " is-selected" : ""}${alreadyAdded ? " is-added" : ""}`}
                    onClick={() => toggleSelected(piece.id)}
                    aria-pressed={isSelected}
                    disabled={alreadyAdded || isSubmitting}
                  >
                    <img
                      className="add-pieces-modal__piece-image"
                      src={piece.imageUrl}
                      alt={piece.name}
                    />

                    <span className="add-pieces-modal__piece-name">
                      {piece.name}
                    </span>

                    {alreadyAdded ? (
                      <span className="add-pieces-modal__piece-badge">
                        already added
                      </span>
                    ) : (
                      isSelected && (
                        <span className="add-pieces-modal__piece-check" aria-hidden="true">
                          ✓
                        </span>
                      )
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <p className="add-pieces-modal__count">
            {selectedIds.size} {selectedIds.size === 1 ? "piece" : "pieces"} selected
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
              {isSubmitting
                ? "adding..."
                : `add ${selectedIds.size} ${selectedIds.size === 1 ? "piece" : "pieces"} ♡`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPiecesModal;
