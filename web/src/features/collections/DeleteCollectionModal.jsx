import { useEscapeKey } from "../../lib/useEscapeKey";
import "../../components/modal.css";
import "./DeleteCollectionModal.css";

function DeleteCollectionModal({
  collectionName,
  isSubmitting,
  errorMessage,
  onCancel,
  onConfirm,
}) {
  useEscapeKey(() => {
    if (!isSubmitting) onCancel();
  });

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
          Delete &ldquo;{collectionName}&rdquo;?
        </h2>

        <p className="modal__body">
          The collection will disappear, but your saved items won&rsquo;t go
          anywhere.
        </p>

        {errorMessage && <p className="modal__error">{errorMessage}</p>}

        <div className="modal__actions">
          <button type="button" className="modal__button" onClick={onCancel} disabled={isSubmitting}>
            Keep it
          </button>

          <button
            type="button"
            className="modal__button modal__button--primary"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteCollectionModal;
