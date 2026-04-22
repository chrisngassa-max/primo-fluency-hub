import { useCallback, useEffect, useRef } from "react";

export interface UseTabReturnOptions {
  onReturn: () => void;
  enabled?: boolean;
  debounceMs?: number;
}

/**
 * Detects when the user comes back to the tab after an explicit "leave"
 * (e.g. after window.open of an external resource).
 *
 * Usage:
 *   const { markLeftTab } = useTabReturn({ onReturn: () => openForm() });
 *   const w = window.open(url, '_blank'); markLeftTab();
 */
export function useTabReturn({
  onReturn,
  enabled = true,
  debounceMs = 500,
}: UseTabReturnOptions) {
  const hasLeftRef = useRef(false);
  const lastFiredRef = useRef(0);
  const onReturnRef = useRef(onReturn);

  useEffect(() => {
    onReturnRef.current = onReturn;
  }, [onReturn]);

  const markLeftTab = useCallback(() => {
    hasLeftRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const fire = () => {
      if (!hasLeftRef.current) return;
      const now = Date.now();
      if (now - lastFiredRef.current < debounceMs) return;
      lastFiredRef.current = now;
      hasLeftRef.current = false;
      onReturnRef.current();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") fire();
    };
    const onFocus = () => fire();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, debounceMs]);

  return { markLeftTab };
}
