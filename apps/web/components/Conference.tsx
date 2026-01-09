"use client";

import {
  selectPeers,
  selectPeersScreenSharing,
  useHMSStore,
  useHMSActions,
  selectLocalPeer,
  selectHasPeerHandRaised,
  selectIsPeerAudioEnabled,
} from "@100mslive/react-sdk";
import { useSpeakerRequestEvent, useSpeakerRejectionEvent } from "@/utils/events";
import PeerWithContextMenu from "./PeerWithContextMenu";
import { ScreenTile } from "./ScreenTile";
import { useEffect, useState, useRef, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useHMSNotifications, HMSNotificationTypes } from '@100mslive/react-sdk';
import RoomEndScreen from "./RoomEndScreen";
import { toast } from "react-toastify";
import { fetchRoomDetails, endRoom } from "@/utils/serverActions";

import { HandRaiseSparks, ScrollingName } from "./experimental";
import {FirelightField} from "./experimental";
import AvatarContextMenu from "./AvatarContextMenu";
import PanelMember from "./PanelMember";
import ListenerMember from "./ListenerMember";
import TippingDrawer from "./TippingDrawer";
import AdsOverlay from "./AdsOverlay";
import { Card } from "./UI/Card";
// import AudioRecoveryBanner from "./AudioRecoveryBanner";


export default function Conference({ roomId }: { roomId: string }) {
  
  const allPeers = useHMSStore(selectPeers);
  const presenters = useHMSStore(selectPeersScreenSharing);
  const localPeer = useHMSStore(selectLocalPeer);
  const hmsActions = useHMSActions();
  const router = useRouter();
  const { user } = useGlobalContext();
  const notification = useHMSNotifications();

  // Audio debugging: Track all peer state changes
  useEffect(() => {
    console.group('[AUDIO DEBUG] Peer Update');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Total peers:', allPeers.length);
    console.log('Peer join order:', allPeers.map(p => ({ 
      id: p.id, 
      name: p.name, 
      role: p.roleName,
      hasAudio: !!p.audioTrack,
      audioTrackId: p.audioTrack 
    })));
    console.groupEnd();
  }, [allPeers]);

  // Ref to track previous peers for empty room detection
  const previousPeersRef = useRef<any[]>([]);

  // Local state for optimistic updates
  const [peers, setPeers] = useState(allPeers);
  const [removedPeers, setRemovedPeers] = useState<Set<string>>(new Set());
  const [isEndingRoom, setIsEndingRoom] = useState(false);
  const [flicker, setFlicker] = useState(0.6);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; left: number }[]>([]);
  
  const {rejectSpeakerRequest} = useSpeakerRejectionEvent();


  const handleReject = (request: SpeakerRequest) => {
    // Validate the request object
    if (!request || !request.peerId) {
      console.error('Invalid speaker request received for rejection');
      return;
    }
    
    // Trigger the SPEAKER_REJECTED event
    rejectSpeakerRequest(request.peerId);

  };


  // Speaker request management
  interface SpeakerRequest {
    peerId: string;
    peerName?: string;
    peerAvatar?: string | null;
    timestamp?: string;
  }
  
  const [speakerRequests, setSpeakerRequests] = useState<SpeakerRequest[]>([]);
  const [showSpeakerRequestsDrawer, setShowSpeakerRequestsDrawer] = useState(false);
  
  const [roomEnded, setRoomEnded] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [showAvatarContextMenu, setShowAvatarContextMenu] = useState(false);
  const [showTippingDrawer, setShowTippingDrawer] = useState(false);

  //function to fetch room details and save name and description in a useState. Call the function in useEffect
  const [roomDetails, setRoomDetails] = useState<{ name: string; description: string } | null>(null);
  

   const handleSpeakerRequest = (event: any) => {
      // Extract peer ID from the event
      const peerId = event.peerId || (event.detail && event.detail.peerId);
      
      console.log("[HMS Event - Conference] Speaker request received", {
        peerId,
        event,
        localRole: localPeer?.roleName,
        timestamp: new Date().toISOString(),
      });
      
      if (!peerId) {
        console.error("[HMS Event - Conference] Speaker request missing peer ID", event);
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

          if (peer && JSON.parse(peer.metadata as string).avatar) {
            newRequest.peerAvatar = JSON.parse(peer.metadata as string).avatar;
          }
          
          // Add the new request
          return [...prevRequests, newRequest];
        });
        
        // Show toast notification with the peer name if available
        const peer = allPeers.find(p => p.id === peerId);
        const displayName = peer?.name || "Someone";
        toast.success(`${displayName} has requested to speak`, {
          autoClose: 3000,
          toastId: `speaker-request-${peerId}-${Date.now()}`
        });
      }
    };

  // Use the custom hook for speaker requests
  useSpeakerRequestEvent((msg) => {
    console.log("[HMS Event - Conference] Speaker request event received", {
      peer: msg.peer,
      timestamp: new Date().toISOString(),
    });
    handleSpeakerRequest({ peerId: msg.peer });
  });

  const handRaise = useHMSNotifications(HMSNotificationTypes.HAND_RAISE_CHANGED);
  const peer = handRaise?.data;

useEffect(() => {
    if (peer && !peer.isLocal && peer.isHandRaised) {
        toast(`${peer.name} raised their hand.`, {
          autoClose: 3000,
          toastId: `hand-raise-${peer.id}-${Date.now()}`
        });
    }
}, [peer]);


  useEffect(() => {
    
    switch (notification?.type) {
      case HMSNotificationTypes.ROOM_ENDED:
        console.log("[HMS Event - Conference] Room ended, showing end screen");
        setRoomEnded(true);
        break;
      // case HMSNotificationTypes.REMOVED_FROM_ROOM:
      //   setRoomEnded(true);
      //   break;
      default:
        break;
    }
  }, [notification, localPeer])


  useEffect(() => {
    async function getRoomDetails() {
      try {
        const response = await fetchRoomDetails(roomId);
        if (response.data.success) {
          setRoomDetails({ 
            name: response.data.data.room.name, 
            description: response.data.data.room.description
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

      // Call API to end the room (skip if in test mode)
      if (!user?._id) {
        console.log('[Conference] Test mode: skipping room end API call');
        await hmsActions.leave();
        router.push('/');
        return;
      }
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

  // REMOVED: Problematic iOS WebKit audio fix that manipulated remote peer volumes
  // This was causing the bug where random participants would be muted when others toggled audio
  // The setVolume() API should only be used for actual volume control, not muting/unmuting
  // Local audio should be controlled with setLocalAudioEnabled() only

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
  const handleApproveRequest = async (request: SpeakerRequest) => {
    if (!request || !request.peerId) {
      console.error("Invalid speaker request for approval", request);
      return;
    }
    
    try {
      // Remove from requests first
      setSpeakerRequests((prevRequests) => 
        prevRequests.filter(req => req.peerId !== request.peerId)
      );
      
      // Change role to speaker
      await hmsActions.changeRoleOfPeer(request.peerId, 'speaker', true);
      
      console.log(`Approved speaker request for peer: ${request.peerId}`);
    } catch (error) {
      console.error('Error approving speaker request:', error);
    }
  };
  
  const handleRejectRequest = (request: SpeakerRequest) => {
    if (!request || !request.peerId) {
      console.error("Invalid speaker request for rejection", request);
      return;
    }
    
    setSpeakerRequests((prevRequests) => 
      prevRequests.filter(req => req.peerId !== request.peerId)
    );
    
    console.log(`Rejected speaker request for peer: ${request.peerId}`);
  };

  const handleAvatarClick = (personId: string) => {
    const peer = allPeers.find(p => p.id === personId);
    if (peer) {
      setSelectedPeer(peer);
      setShowAvatarContextMenu(true);
      setShowTippingDrawer(false);
    }
  };



  // Sponsorship hooks removed as part of ads migration

  // Note: Microphone permissions are now handled in CallClient.tsx during initial room join
  // to prevent repeated permission prompts when Conference component re-renders

  // Sponsorship hooks removed as part of ads migration

  if(roomEnded){
    return <RoomEndScreen onComplete={() => router.push("/")} />
  }
  else{
    // Only show speaker requests button for hosts and co-hosts
    const canManageSpeakers = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
    
    // Prepare peers for CampfireCircle
    const storytellers = peers.filter((peer) => 
      peer.roleName?.toLowerCase() === 'host' || peer.roleName?.toLowerCase() === 'co-host'
    );
    const speakers = peers.filter((peer) => 
      peer.roleName?.toLowerCase() === 'speaker'
    );
    const listeners = peers.filter((peer) => 
      peer.roleName?.toLowerCase() === 'listener'
    );
    
    // Transform peers to format expected by experimental components
    const transformPeer = (peer: any, isHandRaised: boolean = false) => ({
      id: peer.id,
      name: peer.name,
      img: peer.metadata ? JSON.parse(peer.metadata).avatar : undefined,
      role: peer.roleName === 'host' ? 'Host' : peer.roleName === 'co-host' ? 'Co-host' : 'Speaker',
      speaking: peer.audioTrack && peer.audioLevel > 0,
      muted: !peer.audioEnabled,
      handRaised: isHandRaised,
      peer: peer,
    });
    
    const campfirePeople = [...storytellers, ...speakers].map(p => transformPeer(p));
    const listenerPeople = listeners.map(p => transformPeer(p));
    
    // Transform speaker requests to hand raise format
    const handsRaised = speakerRequests.map(req => {
      const peer = allPeers.find(p => p.id === req.peerId);
      return {
        id: req.peerId,
        name: req.peerName || peer?.name || 'Unknown',
        img: req.peerAvatar || (peer?.metadata ? JSON.parse(peer.metadata).avatar : undefined),
        speaking: false,
      };
    });
    
    return (
      <div className="relative min-h-screen">
        <FirelightField flicker={flicker} />

        <Card className="bg-fireside-orange/5 gradient-orange-bg m-3 p-4 rounded-2xl">
          <h1 className="text-lg font-bold gradient-fire-text">{roomDetails?.name}</h1>
          <p className="text-sm text-gray-300">{roomDetails?.description}</p>
        </Card>
        
        <div className="pb-32 px-3 relative z-10 mt-4">
          {/* Speaker Requests Button */}
          {/* {canManageSpeakers && speakerRequests.length > 0 && (
            <div className="flex w-full mb-4 mt-8">
              <Button
                variant="ghost"
                onClick={() => setShowSpeakerRequestsDrawer(true)}
                className="flex items-center gap-2 w-full text-center justify-center"
              >
                <span>Speaker Requests</span>
                <span className="bg-white text-fireside-orange rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {speakerRequests.length}
                <p className="text-gray-400 text-sm">
                  {roomDetails?.description || ""}
                </p>
              </Card>
            </div> */}

            {/* Speakers Grid */}
            {campfirePeople.length > 0 && (
              <div className="mb-6">
                <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,.55)' }}>
                  Panel ({campfirePeople.length})
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {campfirePeople.map((p) => (
                    <PanelMember
                      key={p.id}
                      id={p.id}
                      name={p.name}
                      img={p.img}
                      role={p.role}
                      speaking={p.speaking}
                      muted={p.muted}
                      onClick={handleAvatarClick}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Hand Raise Requests */}
            {handsRaised.length > 0 && (
              <div className="mb-6">
                <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,.55)' }}>
                  Speaker requests ({speakerRequests.length})
                </div>
                <div className="space-y-2">
                  {handsRaised.map((p) => {
                    const request = speakerRequests.find(req => req.peerId === p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-2xl px-3 py-2 backdrop-blur-sm relative"
                        style={{
                          border: '1px solid rgba(255,255,255,.08)',
                          background: 'rgba(0,0,0,.14)',
                        }}
                      >
                        <HandRaiseSparks id={`hand-${p.id}`} />
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="rounded-xl overflow-hidden flex-shrink-0"
                            style={{
                              width: '36px',
                              height: '36px',
                            }}
                          >
                            <img
                              src={p.img || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <ScrollingName 
                              name={p.name}
                              className="text-sm" 
                              style={{ color: 'rgba(255,255,255,.92)' }}
                            />
                            <div className="text-xs" style={{ color: 'rgba(255,255,255,.55)' }}>
                              raised hand
                            </div>
                          </div>
                        </div>
                        {canManageSpeakers && request && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleApproveRequest(request)}
                              className="rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                              style={{
                                border: '1px solid rgba(255,255,255,.08)',
                                background: 'rgba(34,197,94,.15)',
                                color: 'rgba(34,197,94,1)',
                              }}
                            >
                              Invite
                            </button>
                            <button
                              onClick={() => handleReject(request)}
                              className="rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                              style={{
                                border: '1px solid rgba(255,255,255,.08)',
                                background: 'rgba(239,68,68,.15)',
                                color: 'rgba(239,68,68,1)',
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Listeners */}
            {listenerPeople.length > 0 && (
              <div>
                <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,.55)' }}>
                  Listeners ({listenerPeople.length})
                </div>
                <div
                  className="rounded-2xl p-3 backdrop-blur-sm"
                  style={{
                    border: '1px solid rgba(255,255,255,.08)',
                    background: 'rgba(0,0,0,.10)',
                  }}
                >
                  <div className="grid grid-cols-6 gap-3">
                    {listenerPeople.map((p) => (
                      <ListenerMember
                        key={p.id}
                        id={p.id}
                        name={p.name}
                        img={p.img}
                        onClick={handleAvatarClick}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Speaker Requests Drawer */}
          {/* <SpeakerRequestsDrawer
            isOpen={showSpeakerRequestsDrawer}
            onClose={() => setShowSpeakerRequestsDrawer(false)}
            requests={speakerRequests} 
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            roomId={roomId}
          /> */}


          {/* Avatar Context Menu */}
          {selectedPeer && (
            <AvatarContextMenu
              peer={selectedPeer}
              isVisible={showAvatarContextMenu}
              onClose={() => {
                setShowAvatarContextMenu(false);
                setSelectedPeer(null);
              }}
              onOpenTipDrawer={() => {
                setShowAvatarContextMenu(false);
                setShowTippingDrawer(true);
              }}
            />
          )}
          
          {/* Tipping Drawer - Rendered after to appear above */}
          {selectedPeer && (
            <TippingDrawer
              peer={selectedPeer}
              isOpen={showTippingDrawer}
              onClose={() => {
                setShowTippingDrawer(false);
                setSelectedPeer(null);
              }}
            />
          )}
        </div>
    );
  }

  
}
