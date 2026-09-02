import { useEffect, useRef } from "react";

// Re-runs `callback` whenever this tab regains focus/becomes visible
// again - covers "saved something via the Chrome extension (or another
// tab/device) while this tab sat in the background," without needing a
// Supabase Realtime subscription (no new infra, no replication setup).
// Both `focus` and `visibilitychange` are listened for since either can
// fire alone depending on how the user switched back (clicking the
// window vs. switching an OS-level tab/space); the visibleState check
// avoids a redundant call when one fires right after the other.
//
// The callback is kept in a ref rather than the effect's dependency
// array - callers pass a fresh inline function on every render, and
// re-subscribing the listeners every render would be pointless (the
// listeners themselves never need to differ, only what they call).
export function useRefetchOnFocus(callback) {
  const callbackRef = useRef(callback);

  // Updates the ref after every render, inside an effect - mutating a
  // ref directly during render (the function body itself) is not
  // allowed, even though the *reason* for using a ref here is exactly
  // to avoid re-running the effect below on every render.
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    function handleFocus() {
      if (document.visibilityState === "visible") {
        callbackRef.current();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);
}
