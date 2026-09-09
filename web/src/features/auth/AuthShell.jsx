import ClothingRackAnimation from "./ClothingRackAnimation";
import "./AuthShell.css";

// Shared split-screen shell for every auth screen that wants the
// clothing-rack animation (SignInScreen and ForgotPasswordScreen - see
// each file's own comment). `animationRef` is created by the caller
// (useRef) and forwarded straight through to ClothingRackAnimation, so
// the caller's own form inputs can call `animationRef.current
// ?.reportKeystroke()` directly from their onChange handlers without
// lifting any typing state into React - the animation's frame index
// lives entirely inside ClothingRackAnimation, isolated from this
// shell and from whatever form is passed in as `children`, so typing
// never re-renders anything but the animation itself.
function AuthShell({ animationRef, children }) {
  return (
    <div className="auth-shell-page">
      <div className="auth-shell">
        <div className="auth-shell__visual">
          <ClothingRackAnimation ref={animationRef} />
        </div>

        <div className="auth-shell__form-panel">{children}</div>
      </div>
    </div>
  );
}

export default AuthShell;
