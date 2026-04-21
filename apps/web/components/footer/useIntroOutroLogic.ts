"use client";

import { useCallback } from "react";
import { selectLocalPeerRoleName, useHMSStore } from "@100mslive/react-sdk";
import { useCustomAudioTrack, AudioTrackItem } from "@/hooks/useCustomAudioTrack";

/**
 * useIntroOutroLogic - Plays a user's personal intro/outro audio via the same
 * 100ms custom-track pipeline that powers the soundboard.
 *
 * Host-only: only peers with role === 'host' can trigger playback.
 * Intro and outro are mutually exclusive - starting one stops the other.
 */
export interface UseIntroOutroLogicReturn {
  toggleIntro: () => Promise<void>;
  toggleOutro: () => Promise<void>;
  stopAll: () => Promise<void>;
  isIntroPlaying: boolean;
  isOutroPlaying: boolean;
  hasIntro: boolean;
  hasOutro: boolean;
  canUse: boolean;
}

export function useIntroOutroLogic(user: any): UseIntroOutroLogicReturn {
  const localRoleName = useHMSStore(selectLocalPeerRoleName);

  const introUrl: string | undefined = user?.introAudioUrl || undefined;
  const outroUrl: string | undefined = user?.outroAudioUrl || undefined;

  const {
    play: playIntroTrack,
    stop: stopIntroTrack,
    isPlaying: isIntroPlaying,
  } = useCustomAudioTrack({
    defaultVolume: 0.8,
    onPlaybackEnd: () => {
      // eslint-disable-next-line no-console
      console.log("[IntroOutro] intro ended");
    },
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error("[IntroOutro] intro error:", err);
    },
  });

  const {
    play: playOutroTrack,
    stop: stopOutroTrack,
    isPlaying: isOutroPlaying,
  } = useCustomAudioTrack({
    defaultVolume: 0.8,
    onPlaybackEnd: () => {
      // eslint-disable-next-line no-console
      console.log("[IntroOutro] outro ended");
    },
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error("[IntroOutro] outro error:", err);
    },
  });

  const canUse = localRoleName?.toLowerCase() === "host";
  const hasIntro = Boolean(introUrl);
  const hasOutro = Boolean(outroUrl);

  const toggleIntro = useCallback(async () => {
    if (!canUse) return;

    if (isIntroPlaying) {
      await stopIntroTrack();
      return;
    }
    if (!introUrl) return;

    if (isOutroPlaying) {
      try {
        await stopOutroTrack();
      } catch (e) {
        // ignore
      }
    }

    const item: AudioTrackItem = {
      id: `intro-${user?.fid ?? user?._id ?? "self"}`,
      name: "Intro",
      url: introUrl,
    };
    try {
      await playIntroTrack(item);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[IntroOutro] failed to play intro:", err);
    }
  }, [
    canUse,
    introUrl,
    isIntroPlaying,
    isOutroPlaying,
    playIntroTrack,
    stopIntroTrack,
    stopOutroTrack,
    user?.fid,
    user?._id,
  ]);

  const toggleOutro = useCallback(async () => {
    if (!canUse) return;

    if (isOutroPlaying) {
      await stopOutroTrack();
      return;
    }
    if (!outroUrl) return;

    if (isIntroPlaying) {
      try {
        await stopIntroTrack();
      } catch (e) {
        // ignore
      }
    }

    const item: AudioTrackItem = {
      id: `outro-${user?.fid ?? user?._id ?? "self"}`,
      name: "Outro",
      url: outroUrl,
    };
    try {
      await playOutroTrack(item);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[IntroOutro] failed to play outro:", err);
    }
  }, [
    canUse,
    outroUrl,
    isIntroPlaying,
    isOutroPlaying,
    playOutroTrack,
    stopOutroTrack,
    stopIntroTrack,
    user?.fid,
    user?._id,
  ]);

  const stopAll = useCallback(async () => {
    try {
      if (isIntroPlaying) await stopIntroTrack();
      if (isOutroPlaying) await stopOutroTrack();
    } catch (e) {
      // ignore
    }
  }, [isIntroPlaying, isOutroPlaying, stopIntroTrack, stopOutroTrack]);

  return {
    toggleIntro,
    toggleOutro,
    stopAll,
    isIntroPlaying,
    isOutroPlaying,
    hasIntro,
    hasOutro,
    canUse,
  };
}

export default useIntroOutroLogic;
