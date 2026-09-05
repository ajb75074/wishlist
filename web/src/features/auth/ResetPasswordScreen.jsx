import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { MIN_PASSWORD_LENGTH, completePasswordRecovery, updatePassword } from "./auth";
import "./SignInScreen.css";

// This project's Supabase client uses the implicit auth flow (see
// features/auth/auth.js's own comment on why), so a recovery email
// link doesn't carry a PKCE `code` query param - it carries
// access_token/refresh_token/type directly, as a SECOND fragment
// nested inside HashRouter's own route fragment:
//
//   http://host/#/reset-password#access_token=...&refresh_token=...&type=recovery
//
// react-router's HashRouter already parses this correctly on its own:
// it strips the outer '#' and re-parses the remainder with the same
// pathname/search/hash splitting rules any URL gets, so the FIRST '#'
// it finds inside that remainder (right before "access_token") becomes
// its own location.hash, separate from location.pathname
// ("/reset-password"). Confirmed directly against the installed
// react-router source (parsePath / createHashHistory), not assumed -
// so this reads location.hash, never window.location.hash (which
// would return both fragments concatenated as one string) and never a
// query param (there isn't one here).
function parseRecoveryCredentials(hash) {
  if (!hash) return null;

  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  if (params.get("type") !== "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

// Deterministic upper bound on the "checking" state: if
// completePasswordRecovery's network call never resolves at all (a
// genuinely hung request, not a clean success/error response), this
// still forces a transition to "invalid" rather than waiting forever.
const RECOVERY_TIMEOUT_MS = 15000;

// Rendered directly by AuthGate (see its own comment) whenever the app
// is on /reset-password or already holds a recovery session - never
// reached through App.jsx's own <Routes>, so this owns its own
// full-screen states rather than composing with the normal app shell.
function ResetPasswordScreen() {
  const { session, isPasswordRecovery, markPasswordRecovery, clearPasswordRecovery } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const credentials = parseRecoveryCredentials(location.hash);

  // Guards against React 18/19 StrictMode's dev-only double-invoke of
  // effects - setSession works fine called twice with the same token
  // pair, but there's no reason to make two network calls, and the
  // credentials are about to be scrubbed from the URL after the first
  // successful attempt anyway. Unlike a closure-scoped `isCurrent`
  // flag, a ref survives StrictMode's simulated mount -> cleanup ->
  // remount untouched, which is exactly why this - and not isCurrent -
  // is what must decide "has the real attempt already started."
  const hasAttemptedExchange = useRef(false);
  const [exchangeOutcome, setExchangeOutcome] = useState(null); // null | "success" | "failed"

  useEffect(() => {
    if (!credentials || hasAttemptedExchange.current) return;
    hasAttemptedExchange.current = true;

    // No isCurrent/cleanup staleness guard here - that was the actual
    // bug. StrictMode's simulated cleanup ran immediately after this
    // effect's first (real, in-flight) invocation started, flipping a
    // closure-local isCurrent flag to false right away - so by the
    // time completePasswordRecovery's promise actually resolved, its
    // own `.then` callback saw isCurrent === false and silently
    // discarded the result. hasAttemptedExchange already correctly
    // blocked the second (StrictMode remount) invocation from ever
    // starting a replacement request, so nothing was left to ever
    // apply the outcome - the screen was stuck on "checking" forever,
    // every time, only in dev. Setting state after a genuine unmount
    // is a harmless no-op in React 18+, so there's no correctness
    // reason to guard against it here.
    const timeoutId = setTimeout(() => {
      setExchangeOutcome((current) => current ?? "failed");
    }, RECOVERY_TIMEOUT_MS);

    completePasswordRecovery(credentials).then((result) => {
      clearTimeout(timeoutId);

      if (!result.success) {
        setExchangeOutcome("failed");
        return;
      }

      // setSession itself only ever emits SIGNED_IN or TOKEN_REFRESHED
      // (confirmed against the installed @supabase/auth-js source) -
      // never PASSWORD_RECOVERY, since that event is exclusively fired
      // by the library's own URL-detection path, which is off here.
      // Since this code already independently verified type=recovery
      // above, it marks the flag itself rather than waiting for an
      // event that will never come.
      markPasswordRecovery();

      // The tokens are now consumed - immediately scrub them from the
      // address bar. Replacing with just the bare pathname (no hash,
      // no search) is what turns the visible URL into exactly
      // http://localhost:5173/#/reset-password, with nothing sensitive
      // left in it, in history, or copyable. This changes location.hash,
      // which re-runs this effect (credentials become null on the next
      // render) - the guard above makes that rerun a safe no-op rather
      // than a second attempt.
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

  // Derived fresh every render, not stored - covers credentials actively
  // being exchanged, ones that already succeeded/failed this mount, a
  // recovery session that already exists from an earlier mount (the
  // fragment already scrubbed from the URL), someone who's simply
  // already signed in and landed here some other way, and a truly
  // dead/invalid link. See this file's header comment on why this needs
  // to be deliberate rather than a single naive check.
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
