"use client";

import { useState, useEffect } from "react";
import { MicOnIcon, MicOffIcon } from "@100mslive/react-icons";
import { HMSActions, HMSPeer } from "@100mslive/react-sdk";
import { useSpeakerRequestEvent, useSpeakerRejectionEvent } from "@/utils/events";
import { toast } from "react-toastify";

interface MicComponentProps {
  isLocalAudioEnabled: boolean;
  toggleAudio: (() => void) | undefined;
  canUnmute: boolean;
  isRejoining: boolean;
  localRoleName: string | undefined;
  hmsActions: HMSActions;
  localPeer: HMSPeer | undefined;
  user: any;
}

export default function MicComponent({
  isLocalAudioEnabled,
  toggleAudio,
  canUnmute,
  isRejoining,
  localRoleName,
  hmsActions,
  localPeer,
  user
}: MicComponentProps) {
  const [speakerRequested, setSpeakerRequested] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRequest = localStorage.getItem(`speakerRequested_${localPeer?.id || user?.fid}`);
      if (storedRequest === 'true') {
        setSpeakerRequested(true);
      }
    }
  }, [localPeer?.id, user?.fid]);
  
  const { requestToSpeak } = useSpeakerRequestEvent();

  useSpeakerRejectionEvent((msg) => {
    if (msg.peer === (localPeer?.id || user?.fid)) {
      setSpeakerRequested(false);
    }
  })
  
  const isListener = localRoleName === "listener";
  
  const handleRequestToSpeak = () => {
    setSpeakerRequested(true);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`speakerRequested_${localPeer?.id || user?.fid}`, 'true');
    }
    
    requestToSpeak(localPeer?.id as string);
    
    toast.success("🎙️ Speaker request sent", { 
      autoClose: 3000
    });
  };

  useEffect(() => {
    if (canUnmute && speakerRequested) {
      setSpeakerRequested(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`speakerRequested_${localPeer?.id || user?.fid}`);
      }
      toast.success("You can now speak!", { autoClose: 3000 });
    }
  }, [canUnmute, speakerRequested, localPeer?.id, user?.fid]);

  if (isListener && !canUnmute) {
    return (
      <div className="flex flex-col items-center">
        <button
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
            speakerRequested ? "bg-yellow-500 text-white shadow-lg" : "bg-fireside-orange text-white shadow-lg"
          }`}
          onClick={handleRequestToSpeak}
          disabled={speakerRequested || isRejoining}
          title={speakerRequested ? "Speaker request sent" : "Request to speak"}
        >
          {isRejoining ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500">
            {speakerRequested ? "Request sent" : "Request to speak"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <button
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform ${
          canUnmute && !isRejoining
            ? "hover:scale-105 active:scale-95"
            : "opacity-60 cursor-not-allowed"
        } ${
          isLocalAudioEnabled
            ? "bg-fireside-orange text-white shadow-lg"
            : "bg-fireside-red text-white shadow-lg"
        }`}
        onClick={
          canUnmute && !isRejoining
            ? async () => {
                try {
                  console.group('[AUDIO DEBUG] Mute/Unmute Event');
                  console.log('Audio toggle initiated', {
                    currentState: isLocalAudioEnabled,
                    targetState: !isLocalAudioEnabled,
                    peerId: localPeer?.id,
                    peerName: localPeer?.name,
                    role: localRoleName,
                    timestamp: new Date().toISOString(),
                  });
                  
                  console.groupEnd();
                  
                  if (!isLocalAudioEnabled) {
                    console.log("[HMS Action] Lowering hand before unmuting");
                    await hmsActions?.lowerLocalPeerHand?.();
                  }
                  
                  const currentAudioState = isLocalAudioEnabled;
                  await hmsActions.setLocalAudioEnabled(!currentAudioState);
                  
                  console.log('[AUDIO DEBUG] Local audio toggled', {
                    previousState: currentAudioState,
                    newState: !currentAudioState,
                    peerId: localPeer?.id,
                    timestamp: new Date().toISOString(),
                  });
                } catch (error) {
                  console.error("[HMS Action] Error toggling audio:", error);
                  toast.error("Failed to toggle microphone. Please try again.");
                }
              }
            : undefined
        }
        disabled={!canUnmute || isRejoining}
        title={
          isRejoining
            ? "Re-joining with new role..."
            : canUnmute
            ? isLocalAudioEnabled
              ? "Mute"
              : "Unmute"
            : `No permission to publish audio${
                localRoleName ? ` (${localRoleName})` : ""
              }`
        }
      >
        {isRejoining ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isLocalAudioEnabled ? (
          <MicOnIcon className="w-6 h-6" />
        ) : (
          <MicOffIcon className="w-6 h-6" />
        )}
      </button>
      <div className="mt-3 ">
        <p className="text-xs text-gray-500">
          {isRejoining
            ? "Re-joining with new role..."
            : canUnmute
            ? isLocalAudioEnabled
              ? "Tap to mute"
              : "Tap to unmute"
            : "Role cannot unmute"}
        </p>
      </div>
    </div>
  );
}
