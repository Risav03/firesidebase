
"use client";
import { useNavigateWithLoader } from "../utils/useNavigateWithLoader";
import {
  selectPeers,
  selectPeersScreenSharing,
  useHMSStore,
} from "@100mslive/react-sdk";
import PeerWithContextMenu from "./PeerWithContextMenu";
import { ScreenTile } from "./ScreenTile";
import { useEffect, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";

export default function Conference({roomId}:{roomId: string}) {
  const navigate = useNavigateWithLoader();
  const allPeers = useHMSStore(selectPeers);
  const presenters = useHMSStore(selectPeersScreenSharing);
  const localPeer = allPeers.find(peer => peer.isLocal);
  // Listen for END_ROOM_EVENT broadcast from 100ms
  const hmsMessages = useHMSStore((store) => store.messages);
  useEffect(() => {
    if (!localPeer) return;
    const { allIDs, byID } = hmsMessages || {};
    if (allIDs && byID) {
      for (const id of allIDs) {
        const msg = byID[id];
        try {
          const data = JSON.parse(msg.message);
          if (data.type === "END_ROOM_EVENT" && localPeer.roleName !== "host") {
            navigate("/");
            break;
          }
        } catch {
          // ignore
        }
      }
    }
  }, [hmsMessages, localPeer, navigate]);
  
  // Local state for optimistic updates
  const [peers, setPeers] = useState(allPeers);
  const [removedPeers, setRemovedPeers] = useState<Set<string>>(new Set());

  //function to fetch room details and save name and description in a useState. Call the function in useEffect
  const [roomDetails, setRoomDetails] = useState<{ name: string; description: string } | null>(null);

  useEffect(() => {
    async function fetchRoomDetails() {
      const response = await fetch(`/api/rooms/${roomId}`);
      const data = await response.json();
      if (data.success) {
        setRoomDetails({ name: data.room.name, description: data.room.description });
      }
    }

    fetchRoomDetails();
  }, [roomId]);

  useEffect(() => {
    // Update local peers when 100ms peers change
    // Sort peers by role: host > co-host > speaker > listener
  const roleOrder: Record<string, number> = { host: 0, "co-host": 1, speaker: 2, listener: 3 };
    const sortedPeers = allPeers
      .filter(peer => !removedPeers.has(peer.id))
      .sort((a, b) => {
        const aRoleName = typeof a.roleName === "string" ? a.roleName : "listener";
        const bRoleName = typeof b.roleName === "string" ? b.roleName : "listener";
        const aRole = roleOrder[aRoleName] ?? 99;
        const bRole = roleOrder[bRoleName] ?? 99;
        return aRole - bRole;
      });
    setPeers(sortedPeers);
  }, [allPeers, removedPeers]);

  useEffect(() => {
    // Handle optimistic peer removal
    const handlePeerRemoved = (event: CustomEvent) => {
      const { peerId } = event.detail;
      setRemovedPeers(prev => new Set(prev).add(peerId));
    };

    // Handle peer restoration if removal failed
    const handlePeerRestored = (event: CustomEvent) => {
      const { peerId } = event.detail;
      setRemovedPeers(prev => {
        const newSet = new Set(prev);
        newSet.delete(peerId);
        return newSet;
      });
    };

    // Add event listeners
    window.addEventListener('peerRemoved', handlePeerRemoved as EventListener);
    window.addEventListener('peerRestored', handlePeerRestored as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('peerRemoved', handlePeerRemoved as EventListener);
      window.removeEventListener('peerRestored', handlePeerRestored as EventListener);
    };
  }, []);

  return (
    <div className="pt-20 pb-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4 mt-6">
          <h2 className="text-3xl font-bold text-white mb-2">
            {roomDetails?.name || ""} 
          </h2>
          <p className="text-gray-400">
            {roomDetails?.description || ""}
          </p>
        </div>

        <div className="">
          <div className="grid grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-items-center">
            {peers.map((peer) => (
              <PeerWithContextMenu key={peer.id} peer={peer} />
            ))}
          </div>

          {/* {presenters.length > 0 && (
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
          )} */}
        </div>
      </div>
    </div>
  );
}
