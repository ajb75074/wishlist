import { useState } from "react";
import { supabase } from "../../lib/supabase";
import "./SignInScreen.css";

// Deliberately minimal - the whole app is getting a visual redesign
// later, so this is functional-only: email/password, sign in, a
// trivial show/hide toggle. No sign-up (the one account already
// exists), no social auth, no password reset, no onboarding.
function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMessage(error.message || "Could not sign in. Please try again.");
        setIsSubmitting(false);
      }
      // On success, AuthContext's onAuthStateChange listener picks up
      // the new session and AuthGate swaps this screen out - nothing
      // else to do here.
    } catch {
      setErrorMessage("Could not sign in. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="sign-in-screen">
      <form className="sign-in-screen__form" onSubmit={handleSubmit}>
        <h1 className="sign-in-screen__title">wishlist ♡</h1>

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
            autoComplete="current-password"
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

        {errorMessage && <p className="sign-in-screen__error">{errorMessage}</p>}

        <button type="submit" className="sign-in-screen__submit" disabled={isSubmitting}>
          {isSubmitting ? "signing in..." : "sign in"}
        </button>
      </form>
    </div>
  );
}

export default SignInScreen;
