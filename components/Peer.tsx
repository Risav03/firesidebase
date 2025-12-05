"use client";

import { MicOffIcon, PersonIcon } from "@100mslive/react-icons";
import { useState, useEffect, useRef } from "react";
import {
  selectIsPeerAudioEnabled,
  selectPeerAudioByID,
  selectDominantSpeaker,
  useHMSStore,
  HMSPeer,
  selectHasPeerHandRaised,
} from "@100mslive/react-sdk";
import { Card } from "./UI/Card";
import { motion } from "framer-motion";

interface PeerProps {
  peer: HMSPeer;
}
function NameDisplay({ name, roleName }: { name: string; roleName?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [shouldSlide, setShouldSlide] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        const needsSlide = textWidth > containerWidth;
        setShouldSlide(needsSlide);
        if (needsSlide) {
          setOffset(containerWidth - textWidth);
        }
      }
    };

    checkOverflow();
    
    const timeoutId = setTimeout(checkOverflow, 100);
    
    return () => clearTimeout(timeoutId);
  }, [name]);

  return (
    <div 
      ref={containerRef}
      className={`${roleName == "listener" ? " text-[0.7rem] " : " text-sm font-bold "} text-white mt-1 px-1 overflow-hidden relative w-full`}
    >
      <motion.div 
        ref={textRef}
        className="whitespace-nowrap"
        animate={shouldSlide ? {
          x: [0, offset]
        } : {}}
        transition={{
          duration: 6,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
          repeatDelay: 0.5
        }}
        style={{
          display: 'inline-block',
          textAlign: shouldSlide ? 'left' : 'center',
          width: shouldSlide ? 'auto' : '100%',
          padding: "0 5px",
        }}
      >
        {name}
      </motion.div>
    </div>
  );
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
    <div className="flex flex-col w-full min-w-0">
    <Card
      className={`relative w-full aspect-[3/3.5] flex-shrink-0 flex flex-col transition-all border-t-0 border-l-0 border-b-[6px] duration-200 ease-in-out items-center justify-center group object-contain overflow-hidden ${
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
    
        <NameDisplay name={peer.name} roleName={peer.roleName} />
     
    </div>

    
  );
}
