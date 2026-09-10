import { useEscapeKey } from "../../lib/useEscapeKey";
import "../../components/modal.css";
import "./DiscardChangesModal.css";

function DiscardChangesModal({ onCancel, onConfirm }) {
  useEscapeKey(onCancel);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal discard-changes-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-changes-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="discard-changes-title" className="modal__title">
          Discard unsaved changes?
        </h2>

        <p className="modal__body">
          You've moved pieces around on the bed since your last save. Leaving
          now will lose that arrangement.
        </p>

        <div className="modal__actions">
          <button type="button" className="modal__button" onClick={onCancel}>
            Keep editing
          </button>

          <button
            type="button"
            className="modal__button modal__button--primary"
            onClick={onConfirm}
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default DiscardChangesModal;
