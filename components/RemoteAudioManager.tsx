"use client";
import React from "react";
import {
  useHMSStore,
  selectPeers,
} from "@100mslive/react-sdk";

export default function RemoteAudioManager() {
  const peers = useHMSStore(selectPeers);

  // Map<trackId, HTMLAudioElement>
  const audioElsRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());

  // Keep audio elements in sync with current remote audio tracks (but never re-create on mute/role)
  React.useEffect(() => {
    const remoteAudioTrackIds = new Set<string>();

    peers.forEach(peer => {
      if (peer.isLocal) return;
      const trackId = peer.audioTrack;
      if (!trackId) return;

      remoteAudioTrackIds.add(trackId);

      // Ensure an element exists for this track (only create if it doesn't exist)
      if (!audioElsRef.current.has(trackId)) {
        const el = document.createElement("audio");
        el.autoplay = true;
        el.setAttribute("playsinline", "true");
        el.setAttribute("webkit-playsinline", "true");
        el.dataset.hmsRemote = "true";
        el.dataset.trackId = trackId;
        el.style.display = "none"; // keep hidden
        document.body.appendChild(el);
        audioElsRef.current.set(trackId, el);
      }
    });

    // Cleanup elements whose tracks truly disappeared (peer left)
    Array.from(audioElsRef.current.entries()).forEach(([trackId, el]) => {
      if (!remoteAudioTrackIds.has(trackId)) {
        try { el.pause(); } catch {}
        el.remove();
        audioElsRef.current.delete(trackId);
      }
    });
  }, [peers]);

  // iOS/WebView: re-play sweep on any foreground/visibility or orientation changes
  React.useEffect(() => {
    const replayAll = () => {
      Array.from(audioElsRef.current.values()).forEach(el => {
        el.play().catch(() => {});
      });
    };
    const onVis = () => { if (!document.hidden) replayAll(); };
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", replayAll);
    window.addEventListener("orientationchange", replayAll);
    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", replayAll);
      window.removeEventListener("orientationchange", replayAll);
    };
  }, []);

  // Optional: expose a manual unlock (call once after any user gesture)
  React.useEffect(() => {
    (window as any).__hmsUnlockRemoteAudio = () => {
      Array.from(audioElsRef.current.values()).forEach(el => {
        el.play().catch(() => {});
      });
    };
    
    return () => {
      delete (window as any).__hmsUnlockRemoteAudio;
    };
  }, []);

  return null; // purely side-effect manager
}

