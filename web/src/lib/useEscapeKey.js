import { useEffect, useRef } from "react";

// Keeps onEscape in a ref so callers can pass a fresh inline function without
// the listener re-subscribing.
export function useEscapeKey(onEscape, enabled = true) {
  const onEscapeRef = useRef(onEscape);

  // Updated post-render, inside an effect - mutating a ref directly
  // during render is not allowed, even though avoiding a re-render on
  // every call is exactly why this is a ref instead of state.
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onEscapeRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
