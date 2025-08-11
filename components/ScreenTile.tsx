'use client'

import {
  selectScreenShareByPeerID,
  useHMSStore,
  useVideo,
  HMSPeer,
} from "@100mslive/react-sdk";

interface ScreenTileProps {
  peer: HMSPeer;
}

export const ScreenTile = ({ peer }: ScreenTileProps) => {
  const screenshareVideoTrack = useHMSStore(selectScreenShareByPeerID(peer.id));
  const { videoRef } = useVideo({
    trackId: screenshareVideoTrack?.id,
  });

  return (
    <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
      <video 
        ref={videoRef} 
        className="w-full h-64 object-cover" 
        autoPlay 
        muted 
        playsInline 
      />
      <div className="p-3 bg-white">
        <p className="text-sm font-medium text-gray-900 text-center">
          Screen shared by {peer.name} {peer.isLocal ? "(You)" : ""}
        </p>
      </div>
    </div>
  );
};
