import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestPasswordReset } from "./auth";
import AuthShell from "./AuthShell";
import "./AuthForm.css";

const STATUS_IDLE = "idle";
const STATUS_SENDING = "sending";
const STATUS_SENT = "sent";
const STATUS_ERROR = "error";

// Its own route (/forgot-password) - distinct from /reset-password,
// which the recovery email itself must point at (see
// ResetPasswordScreen.jsx). Shares AuthShell (and its clothing-rack
// animation) with SignInScreen/SignUpScreen purely for visual
// consistency.
function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(STATUS_IDLE);
  const [errorMessage, setErrorMessage] = useState("");
  const animationRef = useRef(null);

  const isSubmitting = status === STATUS_SENDING;

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    animationRef.current?.completeToEnd();

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
      <AuthShell animationRef={animationRef}>
        <div className="auth-form">
          <div className="auth-form__transition">
            <h1 className="auth-form__title">Check your email</h1>

            <p className="auth-form__success">
              If an account exists for that email, we&rsquo;ve sent password reset instructions.
            </p>

            <button type="button" className="auth-form__switch" onClick={() => navigate("/sign-in")}>
              Back to sign in
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell animationRef={animationRef}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form__transition">
          <h1 className="auth-form__title">Forgot password</h1>

          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="forgot-password-email">
              email
            </label>
            <input
              id="forgot-password-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                animationRef.current?.reportKeystroke();
              }}
              autoComplete="username"
              disabled={isSubmitting}
              required
            />
          </div>

          {errorMessage && <p className="auth-form__error">{errorMessage}</p>}

          <button type="submit" className="auth-form__submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset link"}
          </button>

          <button
            type="button"
            className="auth-form__switch"
            onClick={() => navigate("/sign-in")}
            disabled={isSubmitting}
          >
            Back to sign in
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export default ForgotPasswordScreen;
