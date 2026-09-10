import { useEscapeKey } from "../../lib/useEscapeKey";
import "../../components/modal.css";
import "./DeleteLookModal.css";

function DeleteLookModal({
  lookName,
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
        className="modal delete-look-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-look-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-look-title" className="modal__title">
          Remove &ldquo;{lookName}&rdquo;?
        </h2>

        <p className="modal__body">
          This outfit will disappear, but your saved items will stay in{" "}
          {collectionName} and Home.
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
            {isSubmitting ? "Removing..." : "Remove outfit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteLookModal;
