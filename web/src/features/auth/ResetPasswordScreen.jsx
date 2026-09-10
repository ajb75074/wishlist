import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { MIN_PASSWORD_LENGTH, completePasswordRecovery, updatePassword } from "./auth";
import "./SignInScreen.css";

// The implicit flow nests its token fragment inside HashRouter's own fragment
// (#/reset-password#access_token=...), so the tokens are parsed by hand.
function parseRecoveryCredentials(hash) {
  if (!hash) return null;

  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  if (params.get("type") !== "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

// Upper bound on the "checking" state, so a hung request can't leave the
// screen stuck.
const RECOVERY_TIMEOUT_MS = 15000;

function ResetPasswordScreen() {
  const { session, isPasswordRecovery, markPasswordRecovery, clearPasswordRecovery } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const credentials = parseRecoveryCredentials(location.hash);

  // A ref (not a closure flag) survives StrictMode's simulated
  // mount/cleanup/remount.
  const hasAttemptedExchange = useRef(false);
  const [exchangeOutcome, setExchangeOutcome] = useState(null); // null | "success" | "failed"

  useEffect(() => {
    if (!credentials || hasAttemptedExchange.current) return;
    hasAttemptedExchange.current = true;

    // Deliberately no staleness guard - StrictMode's simulated cleanup
    // discarded the real result and left the screen stuck.
    const timeoutId = setTimeout(() => {
      setExchangeOutcome((current) => current ?? "failed");
    }, RECOVERY_TIMEOUT_MS);

    completePasswordRecovery(credentials).then((result) => {
      clearTimeout(timeoutId);

      if (!result.success) {
        setExchangeOutcome("failed");
        return;
      }

      // setSession never emits PASSWORD_RECOVERY (only the library's own
      // URL-detection path does, which is off here) - mark the flag
      // directly instead of waiting for an event that won't come.
      markPasswordRecovery();

      // The tokens are consumed - scrub them from the address bar.
      navigate(location.pathname, { replace: true });
      setExchangeOutcome("success");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials?.accessToken, credentials?.refreshToken]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await updatePassword(newPassword);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      setIsSuccess(true);
    } catch {
      setErrorMessage("Could not update your password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinue() {
    clearPasswordRecovery();
    navigate("/", { replace: true });
  }

  let screenState;
  if (credentials) {
    if (exchangeOutcome === "success" || isPasswordRecovery) {
      screenState = "ready";
    } else if (exchangeOutcome === "failed") {
      screenState = "invalid";
    } else {
      screenState = "checking";
    }
  } else if (isPasswordRecovery) {
    screenState = "ready";
  } else if (session) {
    screenState = "already-signed-in";
  } else {
    screenState = "invalid";
  }

  if (screenState === "checking") {
    return (
      <div className="sign-in-screen">
        <div className="sign-in-screen__form">
          <h1 className="sign-in-screen__title">reset password</h1>
          <p>Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  if (screenState === "invalid") {
    return (
      <div className="sign-in-screen">
        <div className="sign-in-screen__form">
          <h1 className="sign-in-screen__title">reset password</h1>
          <p className="sign-in-screen__error">
            This password reset link is invalid or has expired. Request a new one.
          </p>
          <button type="button" className="sign-in-screen__submit" onClick={() => navigate("/", { replace: true })}>
            back to sign in
          </button>
        </div>
      </div>
    );
  }

  if (screenState === "already-signed-in") {
    return (
      <div className="sign-in-screen">
        <div className="sign-in-screen__form">
          <h1 className="sign-in-screen__title">reset password</h1>
          <p>You&rsquo;re already signed in.</p>
          <button type="button" className="sign-in-screen__submit" onClick={handleContinue}>
            continue
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="sign-in-screen">
        <div className="sign-in-screen__form">
          <h1 className="sign-in-screen__title">reset password</h1>
          <p className="sign-in-screen__success">Password updated.</p>
          <button type="button" className="sign-in-screen__submit" onClick={handleContinue}>
            continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sign-in-screen">
      <form className="sign-in-screen__form" onSubmit={handleSubmit}>
        <h1 className="sign-in-screen__title">set new password</h1>

        <label className="sign-in-screen__label" htmlFor="reset-password-new">
          new password
        </label>
        <input
          id="reset-password-new"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          disabled={isSubmitting}
          required
          minLength={6}
        />

        <label className="sign-in-screen__label" htmlFor="reset-password-confirm">
          confirm new password
        </label>
        <input
          id="reset-password-confirm"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          disabled={isSubmitting}
          required
          minLength={6}
        />

        {errorMessage && <p className="sign-in-screen__error">{errorMessage}</p>}

        <button type="submit" className="sign-in-screen__submit" disabled={isSubmitting}>
          {isSubmitting ? "updating..." : "update password"}
        </button>
      </form>
    </div>
  );
}

export default ResetPasswordScreen;
