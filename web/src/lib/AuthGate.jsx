import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import SignInScreen from "../features/auth/SignInScreen";
import SignUpScreen from "../features/auth/SignUpScreen";
import ForgotPasswordScreen from "../features/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "../features/auth/ResetPasswordScreen";

// Each signed-out screen (sign in, sign up, forgot password) now has
// its own real, bookmarkable route rather than being one component
// with internal "mode" state - this is what actually maps those three
// paths to their screens, since App.jsx's own <Routes> never sees them
// (this gate replaces the whole app, App included, whenever there's no
// session - see the block below).
const SIGNED_OUT_ROUTES = {
  "/sign-in": SignInScreen,
  "/sign-up": SignUpScreen,
  "/forgot-password": ForgotPasswordScreen,
};

// The entire "signed out -> show an auth screen instead of the app"
// rule lives here, in one place, rather than as a scattered check
// inside App.jsx - App.jsx (and everything under it) only ever renders
// once a session already exists.
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
    const SignedOutScreen = SIGNED_OUT_ROUTES[location.pathname];
    if (SignedOutScreen) {
      return <SignedOutScreen />;
    }
    // Any other path while signed out (including "/") lands on sign in.
    return <Navigate to="/sign-in" replace />;
  }

  // Signed in but still sitting on an auth route (e.g. the back button,
  // or a stale bookmark from before signing in) - send them into the
  // app instead of showing a sign-in/sign-up form they no longer need.
  if (Object.prototype.hasOwnProperty.call(SIGNED_OUT_ROUTES, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AuthGate;
