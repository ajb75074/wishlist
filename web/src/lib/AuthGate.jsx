import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import SignInScreen from "../features/auth/SignInScreen";
import ResetPasswordScreen from "../features/auth/ResetPasswordScreen";

// The entire "signed out -> show sign-in instead of the app" rule lives
// here, in one place, rather than as a scattered check inside App.jsx -
// App.jsx (and everything under it) only ever renders once a session
// already exists.
//
// Password recovery is checked first and can preempt both branches
// below, in two distinct situations: still on the /reset-password
// route exchanging the email link's code (no session yet - route
// check), or already holding a session that arrived via a
// PASSWORD_RECOVERY event (code already exchanged, e.g. after a
// refresh where the code param is gone from the URL - flag check from
// AuthContext). Without this, a recovery session would look just like
// a normal one and this gate would drop the user straight into the
// app instead of the set-new-password screen. App.jsx's own <Routes>
// never sees /reset-password at all - this intercepts before it.
function AuthGate({ children }) {
  const { session, isLoading, isPasswordRecovery } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (location.pathname === "/reset-password" || isPasswordRecovery) {
    return <ResetPasswordScreen />;
  }

  if (!session) {
    return <SignInScreen />;
  }

  return children;
}

export default AuthGate;
