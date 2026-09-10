import { useEscapeKey } from "../../lib/useEscapeKey";
import "../../components/modal.css";
import "./DonateConfirmModal.css";

function DonateConfirmModal({ count, isSubmitting, errorMessage, onCancel, onConfirm }) {
  const isPlural = count > 1;

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
