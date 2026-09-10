import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import AuthShell from "./AuthShell";
import "./AuthForm.css";

function SignUpScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
    setSuccessMessage("");

    try {
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

      // With email confirmation on, signUp returns no session, so the
      // AuthContext listener never fires - tell the user to confirm by email.
      if (!data.session) {
        setSuccessMessage("Check your email to confirm your account, then sign in.");
        setIsSubmitting(false);
      }
    } catch {
      setErrorMessage("Could not create your account. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell animationRef={animationRef}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form__transition">
          <h1 className="auth-form__title">Create account</h1>

          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="sign-up-name">
              display name
            </label>
            <input
              id="sign-up-name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                reportTyping();
              }}
              autoComplete="name"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="sign-up-email">
              email
            </label>
            <input
              id="sign-up-email"
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
            <label className="auth-form__label" htmlFor="sign-up-password">
              password
            </label>
            <div className="auth-form__password-row">
              <input
                id="sign-up-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  reportTyping();
                }}
                autoComplete="new-password"
                disabled={isSubmitting}
                required
                minLength={6}
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

          <div className="auth-form__field">
            <label className="auth-form__label" htmlFor="sign-up-confirm-password">
              confirm password
            </label>
            <input
              id="sign-up-confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                reportTyping();
              }}
              autoComplete="new-password"
              disabled={isSubmitting}
              required
              minLength={6}
            />
          </div>

          {errorMessage && <p className="auth-form__error">{errorMessage}</p>}
          {successMessage && <p className="auth-form__success">{successMessage}</p>}

          <button type="submit" className="auth-form__submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>

          <button
            type="button"
            className="auth-form__switch"
            onClick={() => navigate("/sign-in")}
            disabled={isSubmitting}
          >
            Already have an account? Sign in
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export default SignUpScreen;
