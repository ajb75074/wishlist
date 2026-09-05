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

  useEffect(() => {
    let isCurrent = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isCurrent) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    // Fires on sign-in, sign-out, and token refresh - keeps `session`
    // current without this component needing to know which of those
    // happened.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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
