'use client'

import {
  selectPeers,
  selectPeersScreenSharing,
  useHMSStore,
} from "@100mslive/react-sdk";
import Peer from "./Peer";
import { ScreenTile } from "./ScreenTile";

export default function Conference() {
  const peers = useHMSStore(selectPeers);
  const presenters = useHMSStore(selectPeersScreenSharing);

  return (
    <div className="pt-24 pb-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Audio Room</h2>
          <p className="text-gray-600">Drop-in and listen to interesting conversations</p>
        </div>
        
        <div className="room-card">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 justify-items-center">
            {peers.map((peer) => (
              <Peer key={peer.id} peer={peer} />
            ))}
          </div>
          
          {presenters.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Screen Share</h3>
              <div className="flex flex-wrap justify-center gap-4">
                {presenters.map((peer) => (
                  <ScreenTile key={"screen" + peer.id} peer={peer} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
