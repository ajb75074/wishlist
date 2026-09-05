import { useState } from "react";
import { requestPasswordReset } from "./auth";
import "./SignInScreen.css";

const STATUS_IDLE = "idle";
const STATUS_SENDING = "sending";
const STATUS_SENT = "sent";
const STATUS_ERROR = "error";

// Rendered by SignInScreen's own mode switch, not a separate route -
// there's nothing here worth deep-linking to, unlike /reset-password
// which the recovery email itself must point at.
function ForgotPasswordScreen({ onBackToSignIn }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(STATUS_IDLE);
  const [errorMessage, setErrorMessage] = useState("");

  const isSubmitting = status === STATUS_SENDING;

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    setStatus(STATUS_SENDING);
    setErrorMessage("");

    try {
      const result = await requestPasswordReset(email);

      if (!result.success) {
        setErrorMessage(
          result.isRateLimited
            ? "You've requested this recently. Please wait a bit before trying again."
            : "Something went wrong. Please try again.",
        );
        setStatus(STATUS_ERROR);
        return;
      }

      setStatus(STATUS_SENT);
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus(STATUS_ERROR);
    }
  }

  if (status === STATUS_SENT) {
    return (
      <div className="sign-in-screen">
        <div className="sign-in-screen__form">
          <h1 className="sign-in-screen__title">check your email</h1>

          <p className="sign-in-screen__success">
            If an account exists for that email, we&rsquo;ve sent password reset instructions.
          </p>

          <button type="button" className="sign-in-screen__switch" onClick={onBackToSignIn}>
            back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sign-in-screen">
      <form className="sign-in-screen__form" onSubmit={handleSubmit}>
        <h1 className="sign-in-screen__title">forgot password</h1>

        <label className="sign-in-screen__label" htmlFor="forgot-password-email">
          email
        </label>
        <input
          id="forgot-password-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          disabled={isSubmitting}
          required
        />

        {errorMessage && <p className="sign-in-screen__error">{errorMessage}</p>}

        <button type="submit" className="sign-in-screen__submit" disabled={isSubmitting}>
          {isSubmitting ? "sending..." : "send reset link"}
        </button>

        <button
          type="button"
          className="sign-in-screen__switch"
          onClick={onBackToSignIn}
          disabled={isSubmitting}
        >
          back to sign in
        </button>
      </form>
    </div>
  );
}

export default ForgotPasswordScreen;
