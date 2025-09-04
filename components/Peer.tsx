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
          <div className={`absolute -inset-2 rounded-full border-4 border-fireside-orange speaking-ring ${!isSpeaking ? 'fade-out' : ''}`}></div>
        )}
        
        <div className={`  border-2 border-white rounded-full relative`}>
          {/* Avatar with first letter of name */}
          <div className={`w-16 h-16 rounded-full bg-fireside-orange flex items-center justify-center text-white text-2xl font-bold ${!isPeerAudioEnabled ? 'opacity-50' : ''}`}>
            {peer.metadata && JSON.parse(peer.metadata).avatar ? (
              <img src={JSON.parse(peer.metadata).avatar} alt={peer.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span>{peer.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          
          {/* Mute indicator */}
          {!isPeerAudioEnabled && peer.roleName !== "listener" && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
              <MicOffIcon className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-center">
        <p className="text-sm font-medium text-white truncate max-w-20">
          {peer.name}
        </p>
        <div className="flex items-center justify-center space-x-1">
          {peer.roleName && (
            <span className={`text-xs leading-none font-semibold px-2 py-1 rounded-full ${
              peer.roleName === 'host' ? 'bg-red-500 text-white' :
              peer.roleName === 'co-host' ? 'bg-orange-500 text-white' :
              peer.roleName === 'speaker' ? 'bg-blue-500 text-white' :
              'bg-gray-500 text-white'
            }`}>
              {peer.roleName}
            </span>
          )}
          {peer.isLocal && (
            <span className="text-xs text-fireside-orange font-semibold">(You)</span>
          )}
        </div>
      </div>
    </div>
  );
}
