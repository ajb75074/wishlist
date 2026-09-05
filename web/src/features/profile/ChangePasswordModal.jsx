import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { MIN_PASSWORD_LENGTH, changePassword } from "../auth/auth";
import "../../components/modal.css";
import "./ChangePasswordModal.css";

// Presentation + one call into auth.js's changePassword helper -
// nothing here reads, stores, or compares the current password itself;
// Supabase Auth alone verifies it (see changePassword's own comment on
// how and what that does to the existing session). All three fields
// are local, temporary component state, cleared immediately on success
// and on every close/cancel path.
function ChangePasswordModal({ onClose }) {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // isSubmitting alone isn't enough to guarantee only one operation
  // ever runs - it's regular React state, so a second call to
  // handleSubmit landing before the next render commits would still
  // read the old (false) value. This ref is set synchronously, in the
  // same tick as the check, so a duplicate call can never slip through
  // the gap between "user submits again" and "React re-renders with
  // the button disabled."
  const isSubmittingRef = useRef(false);

  function clearFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  // Routes every close path (Escape, backdrop click, Cancel, Done)
  // through here so field-clearing never depends on the parent
  // (ProfileView) happening to unmount this component on close - it
  // does today, but this doesn't rely on that as the only thing
  // keeping passwords from lingering.
  function handleClose() {
    if (isSubmitting) return;
    clearFields();
    setErrorMessage("");
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // handleClose itself isn't memoized (it reads isSubmitting fresh
    // each render), so depending on isSubmitting/onClose directly here
    // re-subscribes exactly when either actually changes, rather than
    // on every render - same tradeoff DonateConfirmModal's identical
    // Escape-handling effect already makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitting, onClose]);

  // Runs only from this form's own submit event - never from an
  // effect - so React StrictMode's dev-only double-invoke (which only
  // affects effects, not event handlers) cannot cause this to fire
  // twice. The isSubmitting guard below still covers a real duplicate
  // click/Enter while a request is already in flight.
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
