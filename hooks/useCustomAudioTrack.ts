"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useHMSActions, useHMSStore, selectIsConnectedToRoom } from "@100mslive/react-sdk";

/**
 * AudioTrackItem represents a sound to be played
 */
export interface AudioTrackItem {
  id: string;
  name: string;
  url: string;
  duration?: number; // in milliseconds (optional, will auto-detect)
}

/**
 * UseCustomAudioTrackOptions configuration
 */
export interface UseCustomAudioTrackOptions {
  defaultVolume?: number; // 0-1
  onPlaybackStart?: (item: AudioTrackItem) => void;
  onPlaybackEnd?: (item: AudioTrackItem) => void;
  onError?: (error: Error) => void;
}

/**
 * UseCustomAudioTrackReturn - the return type
 */
export interface UseCustomAudioTrackReturn {
  play: (item: AudioTrackItem) => Promise<void>;
  stop: () => Promise<void>;
  setVolume: (volume: number) => void;
  isPlaying: boolean;
  currentTrack: AudioTrackItem | null;
  isConnected: boolean;
}

/**
 * useCustomAudioTrack - Hook for playing one-shot audio effects via HMS custom tracks
 * 
 * This hook uses the 100ms custom tracks API to broadcast audio to all participants.
 * Unlike usePlaylist, this is designed for short sound effects that play once and stop.
 * 
 * Perfect for: soundboards, notifications, alerts, sound effects
 * 
 * @see https://www.100ms.live/docs/javascript/v2/how-to-guides/extend-capabilities/custom-tracks/custom-tracks
 * 
 * @example
 * ```tsx
 * const { play, stop, isPlaying } = useCustomAudioTrack({
 *   onPlaybackEnd: (item) => console.log('Finished:', item.name)
 * });
 * 
 * // Play a sound effect
 * await play({ id: 'airhorn', name: 'Airhorn', url: '/sounds/airhorn.mp3' });
 * ```
 */
export function useCustomAudioTrack(options: UseCustomAudioTrackOptions = {}): UseCustomAudioTrackReturn {
  const {
    defaultVolume = 0.7,
    onPlaybackStart,
    onPlaybackEnd,
    onError,
  } = options;

  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<AudioTrackItem | null>(null);

  // Refs for cleanup
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaTrackRef = useRef<MediaStreamTrack | null>(null);
  const currentItemRef = useRef<AudioTrackItem | null>(null);
  const isCleaningUpRef = useRef(false); // Flag to prevent error callbacks during cleanup

  /**
   * Cleanup function to stop audio and remove track
   */
  const cleanup = useCallback(async () => {
    // Set flag to prevent error handlers from firing
    isCleaningUpRef.current = true;

    // Remove event handlers first to prevent callbacks
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Remove the track from HMS using the actual MediaStreamTrack
    if (mediaTrackRef.current) {
      try {
        // Stop the MediaStreamTrack itself
        mediaTrackRef.current.stop();
        
        // Try to remove from HMS (may not always work, but that's okay)
        try {
          await hmsActions.removeTrack(mediaTrackRef.current.id);
          console.log("[useCustomAudioTrack] Track removed");
        } catch (e) {
          // HMS might have already cleaned it up, that's fine
          console.log("[useCustomAudioTrack] Track cleanup (may already be removed)");
        }
      } catch (e) {
        // Ignore errors
      }
      mediaTrackRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        await audioContextRef.current.close();
      } catch (e) {
        // Ignore close errors
      }
      audioContextRef.current = null;
    }

    // Reset cleanup flag after a short delay
    setTimeout(() => {
      isCleaningUpRef.current = false;
    }, 100);
  }, [hmsActions]);

  /**
   * Play an audio item
   */
  const play = useCallback(async (item: AudioTrackItem): Promise<void> => {
    if (!isConnected) {
      const error = new Error("Not connected to room");
      onError?.(error);
      throw error;
    }

    try {
      // Stop any currently playing audio first
      await cleanup();

      // Create audio element
      const audio = new Audio(item.url);
      audio.crossOrigin = 'anonymous';
      audio.volume = defaultVolume;
      audioRef.current = audio;
      currentItemRef.current = item;

      // Create AudioContext to get MediaStreamTrack
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Wait for audio to be loaded enough to play
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onLoadError);
          resolve();
        };
        const onLoadError = () => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onLoadError);
          reject(new Error(`Failed to load audio: ${item.url}`));
        };
        audio.addEventListener('canplaythrough', onCanPlay);
        audio.addEventListener('error', onLoadError);
        audio.load();
      });

      // Create audio graph: audio element -> destination (for HMS)
      const source = audioContext.createMediaElementSource(audio);
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect to destination for HMS broadcast
      source.connect(destination);
      
      // Also connect to speakers so the person playing can hear it
      source.connect(audioContext.destination);

      // Get the audio track
      const mediaStreamTrack = destination.stream.getAudioTracks()[0];
      
      if (!mediaStreamTrack) {
        throw new Error("Failed to create audio track");
      }

      // Store the actual track reference for cleanup
      mediaTrackRef.current = mediaStreamTrack;

      // Add the track to HMS
      await hmsActions.addTrack(mediaStreamTrack, 'regular');

      console.log("[useCustomAudioTrack] Track added:", mediaStreamTrack.id);

      // Update state
      setIsPlaying(true);
      setCurrentTrack(item);

      // Handle playback end
      audio.onended = async () => {
        // Skip if we're already cleaning up
        if (isCleaningUpRef.current) return;
        
        console.log("[useCustomAudioTrack] Playback ended:", item.name);
        
        const endedItem = currentItemRef.current;
        
        await cleanup();
        
        setIsPlaying(false);
        setCurrentTrack(null);
        
        if (endedItem) {
          onPlaybackEnd?.(endedItem);
        }
      };

      // Handle errors during playback (not during cleanup)
      audio.onerror = async () => {
        // Skip if we're cleaning up (this fires when we clear the audio)
        if (isCleaningUpRef.current) return;
        
        console.error("[useCustomAudioTrack] Playback error");
        await cleanup();
        setIsPlaying(false);
        setCurrentTrack(null);
        onError?.(new Error(`Playback error: ${item.url}`));
      };

      // Start playback
      await audio.play();

      // Callback
      onPlaybackStart?.(item);

      console.log("[useCustomAudioTrack] Playing:", item.name, item.url);
    } catch (error) {
      console.error("[useCustomAudioTrack] Error playing:", error);
      await cleanup();
      setIsPlaying(false);
      setCurrentTrack(null);
      onError?.(error as Error);
      throw error;
    }
  }, [isConnected, hmsActions, defaultVolume, cleanup, onPlaybackStart, onPlaybackEnd, onError]);

  /**
   * Stop current playback
   */
  const stop = useCallback(async (): Promise<void> => {
    const stoppedItem = currentItemRef.current;
    
    await cleanup();
    
    setIsPlaying(false);
    setCurrentTrack(null);
    
    if (stoppedItem) {
      onPlaybackEnd?.(stoppedItem);
    }
    
    console.log("[useCustomAudioTrack] Stopped");
  }, [cleanup, onPlaybackEnd]);

  /**
   * Set volume (0-100, will be converted to 0-1)
   */
  const setVolume = useCallback((volume: number) => {
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    if (audioRef.current) {
      audioRef.current.volume = normalizedVolume;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    play,
    stop,
    setVolume,
    isPlaying,
    currentTrack,
    isConnected: isConnected ?? false,
  };
}

export default useCustomAudioTrack;
