"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
/** Dateieingaben erst nach Hydrierung freigeben, damit das change-Ereignis verarbeitet wird. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
