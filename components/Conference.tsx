"use client";

import {
  selectPeers,
  selectPeersScreenSharing,
  selectLocalPeer,
  useHMSStore,
} from "@100mslive/react-sdk";
import Peer from "./Peer";
import { ScreenTile } from "./ScreenTile";
import { useEffect } from "react";
import sdk from "@farcaster/miniapp-sdk";

export default function Conference() {
  const peers = useHMSStore(selectPeers);
  const presenters = useHMSStore(selectPeersScreenSharing);
  const localPeer = useHMSStore(selectLocalPeer);

  useEffect(() => {
    async function getPermission() {
      try {
        await sdk.actions.requestCameraAndMicrophoneAccess();
        console.log("Camera and microphone access granted");
        // You can now use camera and microphone in your mini app
      } catch (error) {
        console.log("Camera and microphone access denied");
        // Handle the denial gracefully
      }
    }

    getPermission();
  }, []);

  // Determine current permissions based on role
  const getRolePermissions = () => {
    if (!localPeer?.roleName) return { canSpeak: false, canListen: true, role: 'Unknown' };
    
    const role = localPeer.roleName.toLowerCase();
    switch (role) {
      case 'host':
        return { canSpeak: true, canListen: true, role: 'Host' };
      case 'speaker':
        return { canSpeak: true, canListen: true, role: 'Speaker' };
      case 'listener':
        return { canSpeak: false, canListen: true, role: 'Listener' };
      default:
        return { canSpeak: false, canListen: true, role: role };
    }
  };

  const permissions = getRolePermissions();

  return (
    <div className="pt-24 pb-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4 mt-10">
          <h2 className="text-3xl font-bold text-white mb-2">
            BaseJunkie&apos;s room
          </h2>
          <p className="text-gray-400">
            This is the beginning for Fireside! We are about to make history.
          </p>
          
          {/* Role and Permission Status */}
          <div className="mt-4 p-4 bg-gray-800 rounded-lg max-w-md mx-auto">
            <div className="text-sm text-gray-300 mb-2">
              <span className="font-semibold">Your Role:</span> {permissions.role}
            </div>
            <div className="flex justify-center space-x-4 text-xs">
              <div className={`flex items-center space-x-1 ${permissions.canSpeak ? 'text-green-400' : 'text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${permissions.canSpeak ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span>{permissions.canSpeak ? 'Can Speak' : 'Cannot Speak'}</span>
              </div>
              <div className={`flex items-center space-x-1 ${permissions.canListen ? 'text-green-400' : 'text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${permissions.canListen ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span>{permissions.canListen ? 'Can Listen' : 'Cannot Listen'}</span>
              </div>
            </div>
            {permissions.role === 'Listener' && (
              <p className="text-xs text-yellow-400 mt-2">
                💡 Use the refresh button in the header to check for role updates
              </p>
            )}
          </div>
        </div>

        <div className="">
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-items-center">
            {peers.map((peer) => (
              <Peer key={peer.id} peer={peer} />
            ))}
          </div>

          {presenters.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                Screen Share
              </h3>
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
