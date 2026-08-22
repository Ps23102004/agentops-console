"use client";
import { useCallback, useSyncExternalStore } from "react";

const EVT = "agentops:local";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
};

/**
 * localStorage as a React source. useSyncExternalStore (not an effect) so the
 * value is read at subscribe time and SSR gets the fallback without a flash.
 */
export function useLocal(key: string, fallback: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key) ?? fallback,
    () => fallback,
  );
  const set = useCallback((v: string) => {
    localStorage.setItem(key, v);
    window.dispatchEvent(new Event(EVT));
  }, [key]);
  return [value, set];
}
