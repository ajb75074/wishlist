import { useEffect } from "react";
import "../../components/modal.css";
import "./DonateConfirmModal.css";

// App only renders this while the modal should be open, so each open is
// a fresh mount - no reset-on-open effect needed, same pattern as
// CreateCollectionModal.
// Presentation only - the actual deleteWishlistItem calls happen in
// App.jsx's onConfirm handler (reusing the existing delete logic),
// this component just asks for confirmation first.
function DonateConfirmModal({ count, isSubmitting, errorMessage, onCancel, onConfirm }) {
  const isPlural = count > 1;

  // Escape closes the modal, same as CreateCollectionModal - but not
  // while a donate is actually in flight.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSubmitting) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, isSubmitting]);

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!isSubmitting) onCancel();
      }}
    >
      <div
        className="modal donate-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="donate-confirm-title" className="modal__title">
          {isPlural ? `Donate these ${count} items?` : "Donate this item?"}
        </h2>

        <p className="modal__body">
          {isPlural
            ? "They'll leave your wishlist and any collections they're saved in."
            : "It'll leave your wishlist and any collections it's saved in."}
        </p>

        {errorMessage && <p className="modal__error">{errorMessage}</p>}

        <div className="modal__actions">
          <button type="button" className="modal__button" onClick={onCancel} disabled={isSubmitting}>
            Keep {isPlural ? "them" : "it"}
          </button>

          <button
            type="button"
            className="modal__button modal__button--primary"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Donating..." : "Donate"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DonateConfirmModal;
