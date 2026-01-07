/**
 * useSoundboardLogicRTK - RealtimeKit version of soundboard
 * 
 * STUB IMPLEMENTATION - Soundboard is pending Phase 8 migration.
 * 
 * Once implemented, this will need:
 * - Custom audio track injection via RealtimeKit
 * - Custom events for synchronized sound animations
 * 
 * For now, this provides a disabled implementation so the UI can render.
 */
"use client";

import { useState, useCallback } from "react";
import type { SoundEffect } from "@/utils/soundboard/sounds";

// Match the SoundNotification interface from useSoundboardLogic
export interface SoundNotification {
  id: number;
  soundId: string;
  soundName: string;
  soundEmoji: string;
  senderName: string;
}

export function useSoundboardLogicRTK(user: any) {
  const [volume, setVolume] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSound, setCurrentSound] = useState<SoundEffect | null>(null);
  const [progress, setProgress] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [notifications, setNotifications] = useState<SoundNotification[]>([]);

  // Stub - soundboard is disabled in RTK version
  const canUse = false;
  const availableSounds: SoundEffect[] = [];
  const recentSounds: SoundEffect[] = [];

  const playSound = useCallback(async (sound: SoundEffect) => {
    // Disabled - pending Phase 8 migration
    console.log('[SoundboardRTK] Soundboard is pending migration');
  }, []);

  const stopSound = useCallback(async () => {
    // Disabled - pending Phase 8 migration
  }, []);

  return {
    // All props expected by SoundboardDrawer
    playSound,
    stopSound,
    setVolume,
    isPlaying,
    currentSound,
    progress,
    volume,
    cooldownRemaining,
    isOnCooldown,
    availableSounds,
    recentSounds,
    notifications,
    canUse,
  };
}
