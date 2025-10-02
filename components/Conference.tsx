"use client";

import {
  selectPeers,
  selectPeersScreenSharing,
  useHMSStore,
  useHMSActions,
  selectLocalPeer,
} from "@100mslive/react-sdk";
import { useSpeakerRequestEvent, useSpeakerRejectionEvent, useNewSponsorEvent, useSponsorStatusEvent } from "@/utils/events";
import PeerWithContextMenu from "./PeerWithContextMenu";
import { ScreenTile } from "./ScreenTile";
import RoomSponsor from "./RoomSponsor";
import { useEffect, useState, useRef, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useHMSNotifications, HMSNotificationTypes } from '@100mslive/react-sdk';
import RoomEndScreen from "./RoomEndScreen";
import toast from "react-hot-toast";
import { fetchRoomDetails, endRoom } from "@/utils/serverActions";
import SpeakerRequestsDrawer from "./SpeakerRequestsDrawer";
import PendingSponsorshipsDrawer from "./PendingSponsorshipsDrawer";
import SponsorDrawer from "./SponsorDrawer";


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
  
  // Speaker request management
  interface SpeakerRequest {
    peerId: string;
    peerName?: string;
    peerAvatar?: string | null;
    timestamp?: string;
  }
  
  const [speakerRequests, setSpeakerRequests] = useState<SpeakerRequest[]>([]);
  const [showSpeakerRequestsDrawer, setShowSpeakerRequestsDrawer] = useState(false);
  const [showPendingSponsorshipsDrawer, setShowPendingSponsorshipsDrawer] = useState(false);
  const [showSponsorDrawer, setShowSponsorDrawer] = useState(false);
  
  const [roomEnded, setRoomEnded] = useState(false);

  //function to fetch room details and save name and description in a useState. Call the function in useEffect
  const [roomDetails, setRoomDetails] = useState<{ name: string; description: string, sponsorshipEnabled: boolean } | null>(null);
  

   const handleSpeakerRequest = (event: any) => {
      // Extract peer ID from the event
      const peerId = event.peerId || (event.detail && event.detail.peerId);
      
      if (!peerId) {
        console.error("Speaker request missing peer ID", event);
        return;
      }
      
      // Only hosts and co-hosts should see requests
      if (localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host') {
        setSpeakerRequests((prevRequests) => {
          // Check if this request already exists
          const exists = prevRequests.some(req => req.peerId === peerId);
          if (exists) return prevRequests;
          
          // Create a new request object that matches our interface
          const newRequest: SpeakerRequest = {
            peerId: peerId,
            peerName: "Unknown User", // Default name if not provided
            timestamp: new Date().toISOString() // Current timestamp
          };
          
          // Try to find peer in room to get their name
          const peer = allPeers.find(p => p.id === peerId);
          if (peer && peer.name) {
            newRequest.peerName = peer.name;
          }
          
          // Add the new request
          return [...prevRequests, newRequest];
        });
        
        // Show toast notification with the peer name if available
        const peer = allPeers.find(p => p.id === peerId);
        const displayName = peer?.name || "Someone";
        toast.success(`${displayName} has requested to speak`);
      }
    };

  // Use the custom hook for speaker requests
  useSpeakerRequestEvent((msg) => {
    // Convert the message to our expected event format
    handleSpeakerRequest({ peerId: msg.peer });
  });


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
    async function getRoomDetails() {
      try {
        const response = await fetchRoomDetails(roomId);
        if (response.data.success) {
          setRoomDetails({ 
            name: response.data.data.room.name, 
            description: response.data.data.room.description,
            sponsorshipEnabled: response.data.data.room.sponsorshipEnabled
          });
        }
      } catch (error) {
        console.error('Error fetching room details:', error);
      }
    }

    getRoomDetails();
  }, [roomId]);

  // Function to handle ending room when empty - memoized with useCallback
  const handleEmptyRoom = useCallback(async () => {
    // Only the host should end the room
    if (!localPeer || localPeer.roleName !== 'host' || isEndingRoom) return;

    try {
      setIsEndingRoom(true);

      // Call API to end the room
      const response = await endRoom(roomId, user._id);

      if (!response.ok) {
        console.error('Failed to end empty room:', response.data.error);
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


  // Handle speaker requests
  // useEffect(() => {
  //   // Listen for speaker request events
    
    
  //   // Listen for speaker rejection events
  //   const handleSpeakerRejection = (event: CustomEvent) => {
  //     const { peerId } = event.detail;
      
  //     // Remove the rejected request
  //     setSpeakerRequests((prevRequests) => 
  //       prevRequests.filter(request => request.peerId !== peerId)
  //     );
  //   };
    
  //   // Add event listeners
  //   window.addEventListener('SPEAKER_REQUESTED', handleSpeakerRequest as EventListener);
  //   window.addEventListener('SPEAKER_REJECTED', handleSpeakerRejection as EventListener);
    
  //   // Cleanup
  //   return () => {
  //     window.removeEventListener('SPEAKER_REQUESTED', handleSpeakerRequest as EventListener);
  //     window.removeEventListener('SPEAKER_REJECTED', handleSpeakerRejection as EventListener);
  //   };
  // }, [localPeer?.roleName]);

  // Handle request approval and rejection
  const handleApproveRequest = (request: SpeakerRequest) => {
    if (!request || !request.peerId) {
      console.error("Invalid speaker request for approval", request);
      return;
    }
    
    setSpeakerRequests((prevRequests) => 
      prevRequests.filter(req => req.peerId !== request.peerId)
    );
    
    // Log success
    console.log(`Approved speaker request for peer: ${request.peerId}`);
  };
  
  const handleRejectRequest = (request: SpeakerRequest) => {
    if (!request || !request.peerId) {
      console.error("Invalid speaker request for rejection", request);
      return;
    }
    
    setSpeakerRequests((prevRequests) => 
      prevRequests.filter(req => req.peerId !== request.peerId)
    );
    
    // Log rejection
    console.log(`Rejected speaker request for peer: ${request.peerId}`);
  };

  // Use the custom hook for speaker rejections
  useSpeakerRejectionEvent((msg) => {
    handleRejectRequest({peerId: msg.peer});
  });

  // Listen for new sponsorship requests and show a toast to admins
  useNewSponsorEvent((msg) => {
    // Only show the notification to hosts
    if (localPeer?.roleName === 'host') {
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-black/80 shadow-lg rounded-lg pointer-events-auto ring-1 ring-fireside-orange/30 mb-2 border border-fireside-orange/30 relative overflow-hidden`}
          >
            <div className="flex">
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="h-10 w-10 rounded-full bg-fireside-orange/20 flex items-center justify-center">
                      <svg className="h-6 w-6 text-fireside-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-fireside-orange">
                      New Sponsorship Request
                    </p>
                    <p className="mt-1 text-sm text-gray-300">
                      {msg.sponsorName} has submitted a new sponsorship request for this room.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-fireside-orange/30">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    setShowPendingSponsorshipsDrawer(true);
                  }}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-fireside-orange hover:text-fireside-orange/70 focus:outline-none"
                >
                  View
                </button>
              </div>
            </div>
            {/* Timer bar */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-fireside-orange/20">
              <div 
                className="h-full bg-fireside-orange transition-all duration-100 ease-linear"
                style={{
                  width: t.visible ? '100%' : '0%',
                  animation: t.visible ? 'toast-timer 4s linear forwards' : 'none'
                }}
              />
            </div>
            <style jsx>{`
              @keyframes toast-timer {
                from { width: 100%; }
                to { width: 0%; }
              }
            `}</style>
          </div>
        )
      );
    }
  });

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

  useSponsorStatusEvent((msg) => {

    // Check if the userId matches the current user's ID
    if (user && (Number(user.fid) === Number(msg.userId))) {
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-black/80 shadow-lg rounded-lg pointer-events-auto ring-1 ring-fireside-orange/30 mb-2 border border-fireside-orange/30 relative overflow-hidden`}
          >
            <div className="flex">
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className={`text-sm font-medium ${msg.status == "approved" ? "text-green-500" : "text-red-500"}`}>
                      Sponsorship {msg.status}
                    </p>
                    <p className="mt-1 text-sm text-gray-300">
                      {msg.status == "approved" ? "Proceed to pay by clicking here or on Sponsor Fireside button." : ""}
                    </p>
                  </div>
                </div>
              </div>
              <div className={`flex border-l ${msg.status == "approved" ? "border-green-500/30" : "border-red-500/30"}`}>
                <button
                  onClick={() => { 
                    if (msg.status == "approved"){
                      setShowSponsorDrawer(true);
                    }
                    toast.dismiss(t.id);
                  }}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-green-500 hover:text-green-400 focus:outline-none"
                >
                  {msg.status == "approved" ? "Go Live!" : "Got it"}
                </button>
              </div>
            </div>
            {/* Timer bar */}
            <div className={`absolute bottom-0 left-0 w-full h-1 ${msg.status == "approved" ? "bg-green-500/20" : "bg-red-500/20"}`}>
              <div 
                className={`h-full ${msg.status == "approved" ? "bg-green-500" : "bg-red-500"} transition-all duration-100 ease-linear`}
                style={{
                  width: t.visible ? '100%' : '0%',
                  animation: t.visible ? 'toast-timer 4s linear forwards' : 'none'
                }}
              />
            </div>
            <style jsx>{`
              @keyframes toast-timer {
                from { width: 100%; }
                to { width: 0%; }
              }
            `}</style>
          </div>
        )
      );
    }
  });

  if(roomEnded){
    return <RoomEndScreen onComplete={() => router.push("/")} />
  }
  else{
    // Only show speaker requests button for hosts and co-hosts
    const canManageSpeakers = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
    
    return (
      <div className="pt-20 pb-32 px-6 relative">
        {roomDetails?.sponsorshipEnabled && <RoomSponsor roomId={roomId} />}
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4 mt-6 relative">
            {/* Speaker Requests Button - Only shown to hosts/co-hosts and when there are requests */}
            {canManageSpeakers && speakerRequests.length > 0 && (
              <div className="flex w-full justify-end mb-4">
                <button
                  onClick={() => setShowSpeakerRequestsDrawer(true)}
                  className="bg-fireside-orange hover:bg-orange-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <span>Speaker Requests</span>
                  <span className="bg-white text-fireside-orange rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {speakerRequests.length}
                  </span>
                </button>
              </div>
            )}
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
        
        {/* Speaker Requests Drawer */}
        <SpeakerRequestsDrawer
          isOpen={showSpeakerRequestsDrawer}
          onClose={() => setShowSpeakerRequestsDrawer(false)}
          requests={speakerRequests} 
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          roomId={roomId}
        />

        {/* Pending Sponsorships Drawer - Only visible for hosts */}
        {localPeer?.roleName === 'host' && (
          <PendingSponsorshipsDrawer
            isOpen={showPendingSponsorshipsDrawer}
            onClose={() => setShowPendingSponsorshipsDrawer(false)}
            roomId={roomId}
          />
        )}

        {/* Sponsor Drawer */}
        <SponsorDrawer
          isOpen={showSponsorDrawer}
          onClose={() => setShowSponsorDrawer(false)}
          roomId={roomId}
        />
      </div>
    );
  }

  
}
