import { useAuth } from "./AuthContext";
import SignInScreen from "../features/auth/SignInScreen";

// The entire "signed out -> show sign-in instead of the app" rule lives
// here, in one place, rather than as a scattered check inside App.jsx -
// App.jsx (and everything under it) only ever renders once a session
// already exists.
function AuthGate({ children }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (!session) {
    return <SignInScreen />;
  }

  return children;
}

export default AuthGate;
