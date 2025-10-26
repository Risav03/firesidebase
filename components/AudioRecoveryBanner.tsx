"use client";

import { useState, useEffect } from "react";
import { useHMSActions, useHMSStore, selectPeers } from "@100mslive/react-sdk";
import { toast } from "react-toastify";

export default function AudioRecoveryBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const hmsActions = useHMSActions();
  const peers = useHMSStore(selectPeers);

  useEffect(() => {
    // Check for autoplay issues on iOS Safari
    const checkAudioContext = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const testContext = new AudioContext();
          if (testContext.state === 'suspended') {
            setShowBanner(true);
          }
          testContext.close();
        }
      } catch (error) {
        console.warn('[AudioRecoveryBanner] Error checking audio context:', error);
      }
    };

    // Check periodically
    const interval = setInterval(checkAudioContext, 5000);
    checkAudioContext();

    return () => clearInterval(interval);
  }, []);

  const handleResumeAudio = async () => {
    try {
      // Create and immediately play a silent audio to resume autoplay
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Force HMS to refresh audio output using setVolume
      // Per 100ms docs: setVolume(0, trackId) mutes, setVolume(100, trackId) unmutes on iOS
      try {
        const remotePeersWithAudio = peers.filter(p => !p.isLocal && p.audioTrack);
        for (const peer of remotePeersWithAudio) {
          // Re-set to 100 to kick audio tracks and fix iOS routing
          await hmsActions.setVolume(100, peer.audioTrack!);
        }
      } catch (error) {
        console.debug('[AudioRecoveryBanner] Could not refresh audio tracks:', error);
      }

      setShowBanner(false);
      toast.success('Audio resumed');
      console.log('[AudioRecoveryBanner] Audio context resumed');
    } catch (error) {
      console.error('[AudioRecoveryBanner] Failed to resume audio:', error);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
      <div className="bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4">
        <span className="text-lg">🔊</span>
        <div>
          <p className="font-semibold">Audio Paused</p>
          <p className="text-sm text-yellow-100">Tap to resume audio</p>
        </div>
        <button
          onClick={handleResumeAudio}
          className="bg-white text-yellow-600 px-4 py-2 rounded font-semibold hover:bg-yellow-50 transition-colors"
        >
          Resume
        </button>
      </div>
    </div>
  );
}

