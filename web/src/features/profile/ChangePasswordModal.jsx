import { useRef, useState } from "react";
import { useAuth } from "../../lib/useAuth";
import { useEscapeKey } from "../../lib/useEscapeKey";
import { MIN_PASSWORD_LENGTH, changePassword } from "../auth/auth";
import "../../components/modal.css";
import "./ChangePasswordModal.css";

function ChangePasswordModal({ onClose }) {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // isSubmitting state alone can't prevent a duplicate call landing
  // before the next render commits - this ref is set synchronously in
  // the same tick as the check instead.
  const isSubmittingRef = useRef(false);

  function clearFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function handleClose() {
    if (isSubmitting) return;
    clearFields();
    setErrorMessage("");
    onClose();
  }

  useEscapeKey(handleClose);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmittingRef.current) return;

    if (!currentPassword) {
      setErrorMessage("Enter your current password.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New passwords don't match.");
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage("Choose a new password that's different from your current password.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await changePassword({ email: user.email, currentPassword, newPassword });

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      clearFields();
      setIsSuccess(true);
    } catch {
      setErrorMessage("Could not update your password. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal change-password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="change-password-title" className="modal__title">
          {isSuccess ? "password updated" : "change password"}
        </h2>

        {isSuccess ? (
          <>
            <p className="modal__body">Your password has been updated.</p>

            <div className="modal__actions">
              <button type="button" className="modal__button modal__button--primary" onClick={handleClose}>
                done
              </button>
            </div>
          </>
        ) : (
          <form className="change-password-modal__form" onSubmit={handleSubmit}>
            <label className="change-password-modal__label" htmlFor="change-password-current">
              current password
            </label>
            <input
              id="change-password-current"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={isSubmitting}
              required
            />

            <label className="change-password-modal__label" htmlFor="change-password-new">
              new password
            </label>
            <input
              id="change-password-new"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
              required
              minLength={6}
            />

            <label className="change-password-modal__label" htmlFor="change-password-confirm">
              confirm new password
            </label>
            <input
              id="change-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
              required
              minLength={6}
            />

            {errorMessage && <p className="modal__error">{errorMessage}</p>}

            <div className="modal__actions">
              <button type="button" className="modal__button" onClick={handleClose} disabled={isSubmitting}>
                cancel
              </button>
              <button type="submit" className="modal__button modal__button--primary" disabled={isSubmitting}>
                {isSubmitting ? "updating..." : "change password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ChangePasswordModal;
