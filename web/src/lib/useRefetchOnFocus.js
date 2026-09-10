import { useEffect, useRef } from "react";

// Re-runs callback when this tab regains focus - covers a save made via the
// extension or another tab.
export function useRefetchOnFocus(callback) {
  const callbackRef = useRef(callback);

  // Kept in a ref (updated post-render, not during it) rather than the
  // effect's own dependency array, so callers can pass a fresh inline
  // function every render without re-subscribing the listeners below.
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
