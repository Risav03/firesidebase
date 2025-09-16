"use client";

import {
  selectPeers,
  selectPeersScreenSharing,
  useHMSStore,
  useHMSActions,
  selectLocalPeer,
} from "@100mslive/react-sdk";
import PeerWithContextMenu from "./PeerWithContextMenu";
import { ScreenTile } from "./ScreenTile";
import { useEffect, useState, useRef, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useHMSNotifications, HMSNotificationTypes } from '@100mslive/react-sdk';
import RoomEndScreen from "./RoomEndScreen";
import toast from "react-hot-toast";


export default function Conference({ roomId }: { roomId: string }) {
  const allPeers = useHMSStore(selectPeers);
  const presenters = useHMSStore(selectPeersScreenSharing);
  const localPeer = useHMSStore(selectLocalPeer);
  const hmsActions = useHMSActions();
  const router = useRouter();
  const { user } = useGlobalContext();
  const notification = useHMSNotifications();
  // Ref to track previous peers for empty room detection
  const previousPeersRef = useRef<any[]>([]);

  // Local state for optimistic updates
  const [peers, setPeers] = useState(allPeers);
  const [removedPeers, setRemovedPeers] = useState<Set<string>>(new Set());
  const [isEndingRoom, setIsEndingRoom] = useState(false);

  const [roomEnded, setRoomEnded] = useState(false);

  //function to fetch room details and save name and description in a useState. Call the function in useEffect
  const [roomDetails, setRoomDetails] = useState<{ name: string; description: string } | null>(null);
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';


  const handRaise = useHMSNotifications(HMSNotificationTypes.HAND_RAISE_CHANGED);
  const peer = handRaise?.data;

useEffect(() => {
    if (peer && !peer.isLocal && peer.isHandRaised) {
        toast(`${peer.name} raised their hand.`);
    }
}, [peer]);


  useEffect(() => {
    switch (notification?.type) {
      case HMSNotificationTypes.ROOM_ENDED:
        
        
        setRoomEnded(true);
        break;
      // case HMSNotificationTypes.REMOVED_FROM_ROOM:
      //   setRoomEnded(true);
      //   break;
      default:
        break;
    }
  }, [notification])

  useEffect(() => {
    async function fetchRoomDetails() {
      const response = await fetch(`${URL}/api/rooms/public/${roomId}`);
      const data = await response.json();
      if (data.success) {
        setRoomDetails({ name: data.data.room.name, description: data.data.room.description });
      }
    }

    fetchRoomDetails();
  }, [roomId]);

  // Function to handle ending room when empty - memoized with useCallback
  const handleEmptyRoom = useCallback(async () => {
    // Only the host should end the room
    if (!localPeer || localPeer.roleName !== 'host' || isEndingRoom) return;

    try {
      setIsEndingRoom(true);
      const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

      // Call API to end the room
      const response = await fetch(`${URL}/api/rooms/${roomId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user._id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to end empty room:', errorData.error);
        setIsEndingRoom(false);
        return;
      }


      // Leave the room
      await hmsActions.leave();
      router.push('/');
    } catch (error) {
      console.error('Error ending empty room:', error);
      setIsEndingRoom(false);
    }
  }, [roomId, user, localPeer, isEndingRoom, hmsActions, router]);

  useEffect(() => {
    // Update local peers when 100ms peers change
    const uniquePeers = new Map();
    allPeers.forEach(peer => {
      if (!removedPeers.has(peer.id)) {
        uniquePeers.set(peer.id, peer);
      }
    });

    // Get peers and sort by role priority: host > co-host > speaker > listener
    const currentPeers = Array.from(uniquePeers.values());

    // Define role priority order
    const rolePriority: { [key: string]: number } = {
      'host': 1,
      'co-host': 2,
      'speaker': 3,
      'listener': 4
    };

    // Sort peers by role priority
    const sortedPeers = currentPeers.sort((a, b) => {
      const roleA = a.roleName?.toLowerCase() || 'listener';
      const roleB = b.roleName?.toLowerCase() || 'listener';

      return (rolePriority[roleA] || 5) - (rolePriority[roleB] || 5);
    });

    setPeers(sortedPeers);

    // Check if room is empty and should be ended
    // Use a timer to ensure we don't end the room during transient states
    let emptyRoomTimer: NodeJS.Timeout | null = null;

    if (currentPeers.length === 0 && previousPeersRef.current.length > 0) {
      // Wait 10 seconds before ending the room to ensure it's really empty
      emptyRoomTimer = setTimeout(() => {
        // We'll re-use the latest allPeers value when the timeout executes
        if (allPeers.length === 0) {
          handleEmptyRoom();
        } else {
        }
      }, 10000); // 10 second delay
    }

    // Update the previous peers reference
    previousPeersRef.current = currentPeers;

    // Clear timeout if component unmounts or peers change
    return () => {
      if (emptyRoomTimer) {
        clearTimeout(emptyRoomTimer);
      }
    };
  }, [allPeers, removedPeers, handleEmptyRoom]);

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

  useEffect(() => {
    async function getPermission() {
      try {
        await sdk.actions.requestCameraAndMicrophoneAccess();
        // You can now use camera and microphone in your mini app
      } catch (error) {
        // Handle the denial gracefully
      }
    }

    getPermission();
  }, []);

  if(roomEnded){
    return <RoomEndScreen onComplete={() => router.push("/")} />
  }
  else{

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

  
}
