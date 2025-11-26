"use client";

import { MicOffIcon, PersonIcon } from "@100mslive/react-icons";
import { useState, useEffect } from "react";
import {
  selectIsPeerAudioEnabled,
  selectPeerAudioByID,
  selectDominantSpeaker,
  useHMSStore,
  HMSPeer,
  selectHasPeerHandRaised,
} from "@100mslive/react-sdk";
import { Card } from "./UI/Card";

interface PeerProps {
  peer: HMSPeer;
}

export default function Peer({ peer }: PeerProps) {
  const isPeerAudioEnabled = useHMSStore(selectIsPeerAudioEnabled(peer.id));
  const peerAudioLevel = useHMSStore(selectPeerAudioByID(peer.id));
  const dominantSpeaker = useHMSStore(selectDominantSpeaker);
  const isHandRaised = useHMSStore(selectHasPeerHandRaised(peer.id));

  const [showSpeakingRing, setShowSpeakingRing] = useState(false);

  // Check if this peer is currently speaking
  const isSpeaking = isPeerAudioEnabled && peerAudioLevel > 0;

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
    <Card
      className={`relative w-full aspect-[3/3.5] flex flex-col transition-all duration-200 ease-in-out items-center justify-center group object-contain overflow-hidden ${
        peer.roleName === "host"
          ? "bg-fireside-red/10 ring-fireside-red shadow-fireside-red/30 text-white"
          : peer.roleName === "co-host"
          ? "bg-fireside-orange/10 ring-fireside-orange shadow-fireside-orange/30 text-white"
          : peer.roleName === "speaker"
          ? "bg-fireside-blue/10 ring-fireside-blue shadow-fireside-blue/30 text-white"
          : "bg-gray-500/10 ring-gray-500 shadow-gray-500/30 text-white"
      } ${showSpeakingRing ? "ring-2 shadow-lg" : "ring-0 shadow-none"} `}
    >
      {peer.metadata && (
        <img
          src={JSON.parse(peer.metadata).avatar}
          alt={peer.name}
          className={`w-full h-full object-cover transition-all duration-300 ease-in-out ${!isPeerAudioEnabled && peer.roleName !== "listener" ? "opacity-30" : ""}`}
        />
      )}
      {/* <div className="relative">
        
        <div className={` shadow-lg shadow-black/50 rounded-full relative`}>
          
          
          {!isPeerAudioEnabled && peer.roleName !== "listener" && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-fireside-red rounded-full flex items-center justify-center border-2 border-white">
              <MicOffIcon className="w-3 h-3 text-white" />
            </div>
          )}
          
  
          {isHandRaised && (
            <div className="absolute -top-1 -left-1 w-6 h-6 z-50 bg-fireside-orange rounded-full flex items-center justify-center border-2 border-white">
              <span className="text-white text-xs">✋</span>
            </div>
          )}
        </div>
      </div> */}

      {!isPeerAudioEnabled && peer.roleName !== "listener" && (<div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gray-300/30 rounded-full flex items-center justify-center ">
        <MicOffIcon className="w-6 h-6 text-white" />
      </div>)}

      {isHandRaised && (
            <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11  rounded-full flex items-center justify-center bg-fireside-orange border-2 border-white">
              <span className="text-white text-sm">✋</span>
            </div>
          )}

      <div
        className={`mt-1 text-center absolute pb-3 bottom-0 bg-gradient-to-b from-transparent via-black/50 to-black/90 z-50 w-full `}
      >
        <p className="text-[0.8rem] font-bold text-white truncate max-w-full translate-y-2 text-center px-1 ">
          {peer.name}
        </p>
      </div>
    </Card>
  );
}
