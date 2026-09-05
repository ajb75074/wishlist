import { useState } from "react";
import { supabase } from "../../lib/supabase";
import "./SignInScreen.css";

const MODE_SIGN_IN = "sign-in";
const MODE_SIGN_UP = "sign-up";

// Deliberately minimal - the whole app is getting a visual redesign
// later, so this is functional-only: email/password (+name on
// sign-up), a trivial show/hide toggle, a mode switch. No social
// auth, no password reset, no onboarding - those are separate tasks.
function SignInScreen() {
  const [mode, setMode] = useState(MODE_SIGN_IN);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isSignUp = mode === MODE_SIGN_UP;

  function switchMode(nextMode) {
    setMode(nextMode);
    setErrorMessage("");
    setSuccessMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSignIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage(error.message || "Could not sign in. Please try again.");
      setIsSubmitting(false);
    }
    // On success, AuthContext's onAuthStateChange listener picks up
    // the new session and AuthGate swaps this screen out - nothing
    // else to do here.
  }

  async function handleSignUp() {
    if (!name.trim()) {
      setErrorMessage("Please enter your name.");
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match.");
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } },
    });

    if (error) {
      setErrorMessage(error.message || "Could not create your account. Please try again.");
      setIsSubmitting(false);
      return;
    }

    // With email confirmation required, signUp creates the user but
    // returns no session - the AuthContext listener has nothing to
    // react to, so tell the user to confirm by email instead of
    // silently doing nothing. With confirmation off, a session comes
    // back immediately and the listener swaps this screen out exactly
    // like a normal sign-in.
    if (!data.session) {
      setSuccessMessage("Check your email to confirm your account, then sign in.");
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (isSignUp) {
        await handleSignUp();
      } else {
        await handleSignIn();
      }
    } catch {
      setErrorMessage(
        isSignUp ? "Could not create your account. Please try again." : "Could not sign in. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="sign-in-screen">
      <form className="sign-in-screen__form" onSubmit={handleSubmit}>
        <h1 className="sign-in-screen__title">wishlist ♡</h1>

        {isSignUp && (
          <>
            <label className="sign-in-screen__label" htmlFor="sign-in-name">
              name
            </label>
            <input
              id="sign-in-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              disabled={isSubmitting}
              required
            />
          </>
        )}

        <label className="sign-in-screen__label" htmlFor="sign-in-email">
          email
        </label>
        <input
          id="sign-in-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          disabled={isSubmitting}
          required
        />

        <label className="sign-in-screen__label" htmlFor="sign-in-password">
          password
        </label>
        <div className="sign-in-screen__password-row">
          <input
            id="sign-in-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            disabled={isSubmitting}
            required
          />

          <button
            type="button"
            className="sign-in-screen__toggle"
            onClick={() => setShowPassword((current) => !current)}
            disabled={isSubmitting}
          >
            {showPassword ? "hide" : "show"}
          </button>
        </div>

        {isSignUp && (
          <>
            <label className="sign-in-screen__label" htmlFor="sign-in-confirm-password">
              confirm password
            </label>
            <input
              id="sign-in-confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
              required
            />
          </>
        )}

        {errorMessage && <p className="sign-in-screen__error">{errorMessage}</p>}
        {successMessage && <p className="sign-in-screen__success">{successMessage}</p>}

        <button type="submit" className="sign-in-screen__submit" disabled={isSubmitting}>
          {isSubmitting ? (isSignUp ? "creating account..." : "signing in...") : isSignUp ? "sign up" : "sign in"}
        </button>

        <button
          type="button"
          className="sign-in-screen__switch"
          onClick={() => switchMode(isSignUp ? MODE_SIGN_IN : MODE_SIGN_UP)}
          disabled={isSubmitting}
        >
          {isSignUp ? "already have an account? sign in" : "don't have an account? sign up"}
        </button>
      </form>
    </div>
  );
}

export default SignInScreen;
