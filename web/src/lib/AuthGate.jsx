import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import SignInScreen from "../features/auth/SignInScreen";
import SignUpScreen from "../features/auth/SignUpScreen";
import ForgotPasswordScreen from "../features/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "../features/auth/ResetPasswordScreen";
import PrivacyPolicyView from "../components/PrivacyPolicyView";

const SIGNED_OUT_ROUTES = {
  "/sign-in": SignInScreen,
  "/sign-up": SignUpScreen,
  "/forgot-password": ForgotPasswordScreen,
};

// All "signed out -> show an auth screen" routing lives here. Password
// recovery is checked first.
function AuthGate({ children }) {
  const { session, isLoading, isPasswordRecovery } = useAuth();
  const location = useLocation();

  // Reachable regardless of session/loading state - a public document, not
  // an app screen.
  if (location.pathname === "/privacy") {
    return <PrivacyPolicyView />;
  }

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
