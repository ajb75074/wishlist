import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import AuthShell from "./AuthShell";
import "./AuthForm.css";

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

          <p className="auth-form__footer">
            <Link to="/privacy">Privacy</Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}

export default SignInScreen;
