import ClothingRackAnimation from "./ClothingRackAnimation";
import "./AuthShell.css";

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
