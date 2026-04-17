"use client";

import { useWakeLock } from "@/hooks/useWakeLock";

/**
 * Mounts the Screen Wake Lock so the user's device does not dim / sleep
 * while they are on the site. Rendered once in the root layout.
 */
export default function WakeLockManager() {
  useWakeLock(true);
  return null;
}
