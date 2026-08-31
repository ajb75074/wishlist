import { useEffect } from "react";
import "../../components/modal.css";
import "./DeleteLookModal.css";

// Same shell as DeleteCollectionModal - fresh mount while a Look is
// pending removal, Escape/backdrop-click cancel unless a delete is
// actually in flight. The real deleteLook call happens in
// CollectionDetailView's onConfirm handler, this component only asks first.
function DeleteLookModal({
  lookName,
  collectionName,
  isSubmitting,
  errorMessage,
  onCancel,
  onConfirm,
}) {
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
        className="modal delete-look-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-look-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-look-title" className="modal__title">
          remove &ldquo;{lookName}&rdquo;? ♡
        </h2>

        <p className="modal__body">
          this look will disappear, but your saved pieces will stay in{" "}
          {collectionName} and All Saves ♡
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
            {isSubmitting ? "removing..." : "remove look ♡"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteLookModal;
