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
    <div className="peer-container">
      <video ref={videoRef} className="peer-video" autoPlay muted playsInline />
      <div className="peer-name">
        Screen shared by {peer.name} {peer.isLocal ? "(You)" : ""}
      </div>
    </div>
  );
};
