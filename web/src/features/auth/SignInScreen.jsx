import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import AuthShell from "./AuthShell";
import "./AuthForm.css";

// Sign In's own route (/sign-in) - Sign Up and Forgot Password are now
// their own separate routed screens (SignUpScreen.jsx,
// ForgotPasswordScreen.jsx) rather than modes toggled inside this one
// component, but all three still share AuthShell/AuthForm.css for the
// identical split-screen look. Same auth logic/validation/error-
// handling as before this split - only how you get to each screen
// changed. animationRef: each text field's onChange calls
// animationRef.current?.reportKeystroke() directly (an imperative
// handle, not React state), so the clothing-rack animation next to the
// form can react to typing speed without this component ever
// re-rendering because of it - see AuthShell.jsx and
// ClothingRackAnimation.jsx for the actual animation logic.
function SignInScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const animationRef = useRef(null);

  function reportTyping() {
    animationRef.current?.reportKeystroke();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    // Guarantees the animation reaches the end of its loop right as
    // the form submits, regardless of how far typing had gotten it -
    // independent of whether the sign-in call itself succeeds.
    animationRef.current?.completeToEnd();

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
    <AuthShell animationRef={animationRef}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form__transition">
          <h1 className="auth-form__title">Welcome back</h1>

          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="sign-in-email">
              email
            </label>
            <input
              id="sign-in-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                reportTyping();
              }}
              autoComplete="username"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="sign-in-password">
              password
            </label>
            <div className="auth-form__password-row">
              <input
                id="sign-in-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  reportTyping();
                }}
                autoComplete="current-password"
                disabled={isSubmitting}
                required
              />

              <button
                type="button"
                className="auth-form__toggle"
                onClick={() => setShowPassword((current) => !current)}
                disabled={isSubmitting}
              >
                {showPassword ? "hide" : "show"}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="auth-form__forgot-password"
            onClick={() => navigate("/forgot-password")}
            disabled={isSubmitting}
          >
            Forgot password?
          </button>

          {errorMessage && <p className="auth-form__error">{errorMessage}</p>}

          <button type="submit" className="auth-form__submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="button"
            className="auth-form__switch"
            onClick={() => navigate("/sign-up")}
            disabled={isSubmitting}
          >
            New here? Create an account
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export default SignInScreen;
