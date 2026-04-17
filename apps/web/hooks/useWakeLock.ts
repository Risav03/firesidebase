"use client";

import { useEffect, useRef } from "react";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (event: "release", handler: () => void) => void;
  removeEventListener: (event: "release", handler: () => void) => void;
};

/**
 * Keeps the device screen awake while the page is visible.
 *
 * Uses the Screen Wake Lock API (https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API).
 * The lock is automatically re-acquired if the tab becomes visible again after
 * being hidden (browsers release wake locks on visibility change).
 */
export function useWakeLock(enabled: boolean = true): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined") return;

    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    }).wakeLock;

    if (!wakeLock) return;

    let cancelled = false;

    const requestLock = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        if (sentinelRef.current && !sentinelRef.current.released) return;

        const sentinel = await wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null;
          }
        });
      } catch {
        // Fails silently when the browser denies the lock (e.g. battery saver,
        // unsupported environment, or user gesture required).
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestLock();
      }
    };

    requestLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        sentinel.release().catch(() => {});
      }
    };
  }, [enabled]);
}

export default useWakeLock;
