import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext(undefined);

// Owns the one piece of global state genuinely global to the whole
// app - whether anyone's signed in - via Context rather than prop
// drilling through App.jsx, which otherwise has no reason to know
// about auth at all. Deliberately minimal: session/user/isLoading and
// a signOut helper, no Redux/Zustand.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // True while the current session came from a password-reset email
  // link rather than a normal sign-in. AuthGate uses this to keep
  // showing the reset-password screen instead of dropping straight
  // into the app just because a session now technically exists (see
  // AuthGate.jsx). Set explicitly by ResetPasswordScreen (markPasswordRecovery,
  // below) rather than solely inferred from the PASSWORD_RECOVERY auth
  // event: this project's Supabase client uses the implicit flow (see
  // features/auth/auth.js), and the recovery session is established via
  // a direct setSession call, which - confirmed by reading the
  // installed @supabase/auth-js source - only ever emits SIGNED_IN or
  // TOKEN_REFRESHED, never PASSWORD_RECOVERY (that event is only fired
  // from the library's own internal URL-detection path, which is off
  // here via detectSessionInUrl: false). The listener below still
  // covers PASSWORD_RECOVERY too, in case that ever changes.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isCurrent) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    // Fires on sign-in, sign-out, token refresh, and password recovery -
    // keeps `session` current without this component needing to know
    // which of those happened, except PASSWORD_RECOVERY specifically,
    // which also needs its own flag (see above).
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
    // Called by ResetPasswordScreen right after it independently
    // verifies type=recovery and successfully calls setSession - see
    // the flag's own comment above for why this can't just be inferred
    // from the auth event.
    markPasswordRecovery: () => setIsPasswordRecovery(true),
    // Called once the recovery flow's new password has actually been
    // set - the session itself stays valid and becomes a completely
    // normal authenticated session from here on, this just clears the
    // flag so AuthGate lets the user through to the app.
    clearPasswordRecovery: () => setIsPasswordRecovery(false),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
