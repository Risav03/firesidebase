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
    <>
    <Card
      className={`relative w-full aspect-[3/3.5] flex flex-col transition-all border-t-0 border-l-0 border-b-[6px] duration-200 ease-in-out items-center justify-center group object-contain overflow-hidden ${
        peer.roleName === "host"
          ? "bg-fireside-red/10 ring-fireside-red border-fireside-red shadow-fireside-red/30 text-white"
          : peer.roleName === "co-host"
          ? "bg-fireside-orange/10 ring-fireside-orange border-fireside-orange shadow-fireside-orange/30 text-white"
          : peer.roleName === "speaker"
          ? "bg-fireside-blue/10 ring-fireside-blue border-fireside-blue shadow-fireside-blue/30 text-white"
          : "bg-gray-500/10 ring-gray-400 border-gray-400 shadow-black/30 shadow-lg text-white rounded-full"
      } ${showSpeakingRing ? " ring-4 shadow-lg" : "ring-0 shadow-none"} `}
    >
      {peer.metadata && (
        <img
          src={JSON.parse(peer.metadata).avatar}
          alt={peer.name}
          className={`w-full h-full object-cover transition-all duration-300 ease-in-out ${(!isPeerAudioEnabled && peer.roleName !== "listener") ? "opacity-30" : ""} ${peer.roleName === "listener" && "opacity-60" } `}
        />
      )}
      

      {!isPeerAudioEnabled && peer.roleName !== "listener" && (<div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gray-300/30 rounded-full flex items-center justify-center ">
        <MicOffIcon className="w-6 h-6 text-white" />
      </div>)}

      {isHandRaised && (
            <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11  rounded-full flex items-center justify-center bg-fireside-orange border-[1px] border-white">
              <span className="text-white text-sm">✋</span>
            </div>
          )}

      
    </Card>
    
        <p className={` ${peer.roleName == "listener" ? " text-[0.7rem] " : " text-sm font-bold "} text-white truncate max-w-full mt-1 text-center px-1 `}>
          {peer.name}
        </p>
     
    </>

    
  );
}
