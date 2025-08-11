'use client'

import { MicOffIcon, PersonIcon } from "@100mslive/react-icons";
import {
  selectIsPeerAudioEnabled,
  useHMSStore,
  HMSPeer,
} from "@100mslive/react-sdk";

interface PeerProps {
  peer: HMSPeer;
}

export default function Peer({ peer }: PeerProps) {

  const isPeerAudioEnabled = useHMSStore(selectIsPeerAudioEnabled(peer.id));

  return (
    <div className="relative flex flex-col items-center group">
      <div className="peer-avatar relative">
        {/* Avatar with first letter of name */}
        <span>{peer.name.charAt(0).toUpperCase()}</span>
        
        {/* Mute indicator */}
        {!isPeerAudioEnabled && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
            <MicOffIcon className="w-3 h-3 text-white" />
          </div>
        )}
        
        {/* Speaking indicator */}
        {isPeerAudioEnabled && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-clubhouse-green rounded-full animate-pulse"></div>
        )}
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
