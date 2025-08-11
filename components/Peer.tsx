'use client'

import { MicOffIcon, PersonIcon } from "@100mslive/react-icons";
import { useState, useEffect } from "react";
import {
  selectIsPeerAudioEnabled,
  selectPeerAudioByID,
  selectDominantSpeaker,
  useHMSStore,
  HMSPeer,
} from "@100mslive/react-sdk";

interface PeerProps {
  peer: HMSPeer;
}

export default function Peer({ peer }: PeerProps) {
  const isPeerAudioEnabled = useHMSStore(selectIsPeerAudioEnabled(peer.id));
  const peerAudioLevel = useHMSStore(selectPeerAudioByID(peer.id));
  const dominantSpeaker = useHMSStore(selectDominantSpeaker);
  
  const [showSpeakingRing, setShowSpeakingRing] = useState(false);
  
  // Check if this peer is currently speaking
  const isSpeaking = isPeerAudioEnabled && peerAudioLevel > 0 && dominantSpeaker?.id === peer.id;
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isSpeaking) {
      setShowSpeakingRing(true);
    } else {
      // Add a short delay before hiding the ring (300ms)
      timeoutId = setTimeout(() => {
        setShowSpeakingRing(false);
      }, 300);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isSpeaking]);

  return (
    <div className="relative flex flex-col items-center group">
      <div className="relative">
        {/* Speaking indicator ring */}
        {showSpeakingRing && (
          <div className={`absolute -inset-2 rounded-full border-4 border-clubhouse-green speaking-ring ${!isSpeaking ? 'fade-out' : ''}`}></div>
        )}
        
        <div className="peer-avatar relative">
          {/* Avatar with first letter of name */}
          <span>{peer.name.charAt(0).toUpperCase()}</span>
          
          {/* Mute indicator */}
          {!isPeerAudioEnabled && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
              <MicOffIcon className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-center">
        <p className="text-sm font-medium text-gray-900 truncate max-w-20">
          {peer.name}
        </p>
        {peer.isLocal && (
          <span className="text-xs text-clubhouse-green font-semibold">(You)</span>
        )}
      </div>
    </div>
  );
}
