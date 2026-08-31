import { useEffect } from "react";
import "../../components/modal.css";
import "./DeleteCollectionModal.css";

// App only renders this while a collection is pending deletion, so each
// open is a fresh mount - same pattern as CreateCollectionModal and
// DonateConfirmModal. The actual deleteCollection call happens in
// App.jsx's onConfirm handler, this component only asks first.
function DeleteCollectionModal({
  collectionName,
  isSubmitting,
  errorMessage,
  onCancel,
  onConfirm,
}) {
  // Escape closes the modal, but not while a delete is actually in flight.
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
        className="modal delete-collection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-collection-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-collection-title" className="modal__title">
          delete &ldquo;{collectionName}&rdquo;?
        </h2>

        <p className="modal__body">
          the collection will disappear, but your saved pieces won&rsquo;t go
          anywhere ♡
        </p>

        {errorMessage && <p className="modal__error">{errorMessage}</p>}

        <div className="modal__actions">
          <button type="button" className="modal__button" onClick={onCancel} disabled={isSubmitting}>
            keep it
          </button>

          <button
            type="button"
            className="modal__button modal__button--primary"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "deleting..." : "delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteCollectionModal;
