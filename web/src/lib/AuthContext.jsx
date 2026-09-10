import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { AuthContext } from "./authContextInstance";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // True while the session came from a password-reset link, so AuthGate keeps
  // showing the reset screen instead of the app.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isCurrent) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    // Fires on sign-in, sign-out, token refresh, and password recovery.
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      } else if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
      }
    });

    return () => {
      isCurrent = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    isLoading,
    isPasswordRecovery,
    markPasswordRecovery: () => setIsPasswordRecovery(true),
    // Clears the flag once a new password is set, letting AuthGate
    // through to the app - the session itself stays valid throughout.
    clearPasswordRecovery: () => setIsPasswordRecovery(false),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
