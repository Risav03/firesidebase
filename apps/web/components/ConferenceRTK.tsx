"use client";

/**
 * ConferenceRTK - RealtimeKit version of Conference
 * 
 * Key changes from 100ms version:
 * - Uses useParticipants() with .toArray() instead of selectPeers
 * - Uses useLocalParticipant() instead of selectLocalPeer
 * - Uses useStageRequests() for speaker requests via Stage Management
 * - Uses meeting.stage.grantAccess(userIds) for approving requests
 * - Uses meeting.stage.denyAccess(userIds) for rejecting requests
 * - Note: Stage APIs use userId (persistent), not id (session)
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useRealtimeKit } from "@/utils/providers/realtimekit";
import { 
  useParticipants, 
  useLocalParticipant,
  useStageRequests,
  useParticipantActions,
  getParticipantById,
  isHostOrCohost,
  getParticipantRole,
  ROLE_PRIORITY,
  type RealtimeKitParticipant,
  type StageRequest,
} from "@/utils/providers/realtimekit-hooks";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { fetchRoomDetails, endRoom } from "@/utils/serverActions";
import RoomEndScreen from "./RoomEndScreen";
import { Card } from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import { 
  CampfireCircle, 
  FirelightField, 
  AroundTheFireRow, 
  ListGroup, 
  CircleRow, 
  SegTab, 
  HandRaiseSparks, 
  Avatar, 
  ScrollingName 
} from "./experimental";
import { Drawer, DrawerContent } from "@/components/UI/drawer";
import AvatarContextMenuRTK from "./AvatarContextMenuRTK";
import TippingDrawer from "./TippingDrawer";

export default function ConferenceRTK({ roomId }: { roomId: string }) {
  const { meeting, leaveRoom, isConnected } = useRealtimeKit();
  const router = useRouter();
  const { user } = useGlobalContext();

  // Peer management using RTK hooks
  const allParticipants = useParticipants(meeting);
  const localParticipant = useLocalParticipant(meeting);
  const { requests: speakerRequests, grantAccess, denyAccess } = useStageRequests(meeting);
  const { kickAll } = useParticipantActions(meeting);
  
  // Guard: Don't render main content until meeting is connected
  // This prevents errors from accessing null participant properties
  const isReady = isConnected && meeting;

  // Local state
  const [peers, setPeers] = useState<RealtimeKitParticipant[]>([]);
  const [removedPeers, setRemovedPeers] = useState<Set<string>>(new Set());
  const [isEndingRoom, setIsEndingRoom] = useState(false);
  const [flicker, setFlicker] = useState(0.6);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; left: number }[]>([]);
  
  const [showListenersSheet, setShowListenersSheet] = useState(false);
  const [tab, setTab] = useState<"circle" | "campers">("circle");
  
  const [roomEnded, setRoomEnded] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<any>(null);
  const [showAvatarContextMenu, setShowAvatarContextMenu] = useState(false);
  const [showTippingDrawer, setShowTippingDrawer] = useState(false);
  const [roomDetails, setRoomDetails] = useState<{ name: string; description: string } | null>(null);

  // Ref to track previous peers for empty room detection
  const previousPeersRef = useRef<RealtimeKitParticipant[]>([]);

  // Fetch room details
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

  // Handle speaker request notifications
  useEffect(() => {
    if (speakerRequests.length > 0 && isHostOrCohost(localParticipant as any)) {
      const latestRequest = speakerRequests[speakerRequests.length - 1];
      toast.success(`${latestRequest.displayName} has requested to speak`, {
        autoClose: 3000,
        toastId: `speaker-request-${latestRequest.userId}-${Date.now()}`
      });
    }
  }, [speakerRequests, localParticipant]);

  // Function to handle ending room when empty
  const handleEmptyRoom = useCallback(async () => {
    const role = getParticipantRole(localParticipant as any);
    if (!localParticipant || role !== 'host' || isEndingRoom) return;

    try {
      setIsEndingRoom(true);

      if (!user?._id) {
        console.log('[ConferenceRTK] Test mode: skipping room end API call');
        await leaveRoom();
        router.push('/');
        return;
      }

      const response = await endRoom(roomId, user._id);

      if (!response.ok) {
        console.error('Failed to end empty room:', response.data.error);
        setIsEndingRoom(false);
        return;
      }

      await leaveRoom();
      router.push('/');
    } catch (error) {
      console.error('Error ending empty room:', error);
      setIsEndingRoom(false);
    }
  }, [roomId, user, localParticipant, isEndingRoom, leaveRoom, router]);

  // Update peers and handle empty room detection
  useEffect(() => {
    const uniquePeers = new Map<string, RealtimeKitParticipant>();
    allParticipants.forEach(peer => {
      if (!removedPeers.has(peer.id)) {
        uniquePeers.set(peer.id, peer);
      }
    });

    // Sort by role priority
    const currentPeers = Array.from(uniquePeers.values()).sort((a, b) => {
      const roleA = getParticipantRole(a);
      const roleB = getParticipantRole(b);
      return (ROLE_PRIORITY[roleA] || 5) - (ROLE_PRIORITY[roleB] || 5);
    });

    setPeers(currentPeers);

    // Check if room is empty
    let emptyRoomTimer: NodeJS.Timeout | null = null;

    if (currentPeers.length === 0 && previousPeersRef.current.length > 0) {
      emptyRoomTimer = setTimeout(() => {
        if (allParticipants.length === 0) {
          handleEmptyRoom();
        }
      }, 10000);
    }

    previousPeersRef.current = currentPeers;

    return () => {
      if (emptyRoomTimer) {
        clearTimeout(emptyRoomTimer);
      }
    };
  }, [allParticipants, removedPeers, handleEmptyRoom]);

  // Handle peer removal events
  useEffect(() => {
    const handlePeerRemoved = (event: CustomEvent) => {
      const { peerId } = event.detail;
      setRemovedPeers(prev => new Set(prev).add(peerId));
    };

    const handlePeerRestored = (event: CustomEvent) => {
      const { peerId } = event.detail;
      setRemovedPeers(prev => {
        const newSet = new Set(prev);
        newSet.delete(peerId);
        return newSet;
      });
    };

    window.addEventListener('peerRemoved', handlePeerRemoved as EventListener);
    window.addEventListener('peerRestored', handlePeerRestored as EventListener);

    return () => {
      window.removeEventListener('peerRemoved', handlePeerRemoved as EventListener);
      window.removeEventListener('peerRestored', handlePeerRestored as EventListener);
    };
  }, []);

  // Listen for room ended event
  useEffect(() => {
    if (!meeting?.self) return;

    const handleRoomLeft = () => {
      setRoomEnded(true);
    };

    meeting.self.on('roomLeft', handleRoomLeft);

    return () => {
      meeting.self.off('roomLeft', handleRoomLeft);
    };
  }, [meeting]);

  // Handle request approval - uses userId for Stage API
  const handleApproveRequest = async (request: StageRequest) => {
    if (!request?.userId) {
      console.error("Invalid speaker request for approval", request);
      return;
    }
    
    try {
      // Grant stage access using userId (not id)
      await grantAccess([request.userId]);
      console.log(`Approved speaker request for user: ${request.userId}`);
    } catch (error) {
      console.error('Error approving speaker request:', error);
    }
  };
  
  // Handle request rejection - uses userId for Stage API
  const handleRejectRequest = async (request: StageRequest) => {
    if (!request?.userId) {
      console.error("Invalid speaker request for rejection", request);
      return;
    }
    
    try {
      // Deny stage access using userId (not id)
      await denyAccess([request.userId]);
      console.log(`Rejected speaker request for user: ${request.userId}`);
    } catch (error) {
      console.error('Error rejecting speaker request:', error);
    }
  };

  const handleAvatarClick = (personId: string) => {
    const peer = allParticipants.find(p => p.id === personId);
    if (peer) {
      setSelectedPeer(peer);
      setShowAvatarContextMenu(true);
      setShowTippingDrawer(false);
    }
  };

  const openAudience = () => {
    setTab("campers");
  };

  if (roomEnded) {
    return <RoomEndScreen onComplete={() => router.push("/")} />;
  }

  // Show loading state while waiting for meeting to be ready
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-pulse">Connecting to room...</div>
        </div>
      </div>
    );
  }

  // Only show speaker requests button for hosts and co-hosts
  const canManageSpeakers = isHostOrCohost(localParticipant);
  
  // Prepare peers for CampfireCircle
  const storytellers = peers.filter((peer) => {
    const role = getParticipantRole(peer);
    return role === 'host' || role === 'co-host';
  });
  const speakers = peers.filter((peer) => getParticipantRole(peer) === 'speaker');
  const listeners = peers.filter((peer) => getParticipantRole(peer) === 'listener');
  
  // Transform peers to format expected by experimental components
  const transformPeer = (peer: RealtimeKitParticipant) => {
    let metadata: any = {};
    try {
      if (peer.metadata) {
        metadata = JSON.parse(peer.metadata);
      }
    } catch (e) {}

    const role = getParticipantRole(peer);

    return {
      id: peer.id,
      name: peer.name,
      img: peer.picture || metadata.avatar,
      role: role === 'host' ? 'Host' : role === 'co-host' ? 'Co-host' : 'Speaker',
      speaking: peer.audioEnabled,
      muted: !peer.audioEnabled,
      handRaised: false,
      peer: peer,
    };
  };
  
  const campfirePeople = [...storytellers, ...speakers].map(transformPeer);
  const listenerPeople = listeners.map(transformPeer);
  
  // Transform speaker requests to hand raise format
  const handsRaised = speakerRequests.map(req => ({
    id: req.peerId,
    userId: req.userId,
    name: req.displayName,
    img: req.picture,
    speaking: false,
  }));
  
  return (
    <div className="relative min-h-screen">
      <FirelightField flicker={flicker} />
      
      <div className="pb-32 px-3 relative z-10 mt-4">
        {/* Tab Selector */}
        <div className="flex gap-2 rounded-full p-1 backdrop-blur-md mb-2" style={{
          border: '1px solid rgba(255,255,255,.08)',
          background: 'rgba(0,0,0,.14)'
        }}>
          <SegTab
            active={tab === "circle"}
            onClick={() => setTab("circle")}
          >
            Circle
          </SegTab>
          <SegTab
            active={tab === "campers"}
            onClick={() => setTab("campers")}
          >
            Campers{" "}
            <span style={{ color: 'rgba(255,255,255,.55)' }}>
              ({campfirePeople.length + listenerPeople.length})
            </span>
          </SegTab>
        </div>

        {tab === "circle" ? (
          <div className="flex flex-col justify-between">
            {/* Campfire Circle Layout */}
            <CampfireCircle 
              people={campfirePeople}
              reactions={reactions}
              flicker={flicker}
              onAvatarClick={handleAvatarClick}
            />
            
            {/* Listeners */}
            {listeners.length > 0 && (
              <div className="mt-8 w-full">
                <AroundTheFireRow
                  count={listeners.length}
                  people={listenerPeople}
                  onOpen={openAudience}
                  hands={handsRaised}
                  adsOn={false}
                />
              </div>
            )}
          </div>
        ) : (
          <div data-campers-scroll className="rounded-3xl p-4 backdrop-blur-md" style={{
            border: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(0,0,0,.20)'
          }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,.55)' }}>
                  Everyone here
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: 'rgba(255,255,255,.92)' }}>
                  {campfirePeople.length + listenerPeople.length} campers
                </div>
              </div>
            </div>

            <ListGroup title="In the circle">
              {campfirePeople.map((p) => (
                <CircleRow key={p.id} p={p} onAvatarClick={handleAvatarClick} />
              ))}
            </ListGroup>

            {handsRaised.length > 0 && (
              <ListGroup title="Spark requests">
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
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          img={p.img}
                          name={p.name}
                          size={36}
                          speaking={false}
                          fireDistance={0.72}
                          depth={0.6}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm" style={{ color: 'rgba(255,255,255,.92)' }}>
                            {p.name}
                          </div>
                          <div className="text-xs" style={{ color: 'rgba(255,255,255,.55)' }}>
                            raised hand
                          </div>
                        </div>
                      </div>
                      {canManageSpeakers && request && (
                        <div className="flex gap-2">
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
                            onClick={() => handleRejectRequest(request)}
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
              </ListGroup>
            )}

            <div data-audience-anchor />

            {listenerPeople.length > 0 && (
              <ListGroup title="Around the fire">
                <div
                  className="rounded-2xl p-3 backdrop-blur-sm"
                  style={{
                    border: '1px solid rgba(255,255,255,.08)',
                    background: 'rgba(0,0,0,.10)',
                  }}
                >
                  <div className="grid grid-cols-4 gap-2">
                    {listenerPeople.map((p) => (
                      <div key={p.id} className="flex flex-col items-center gap-1" onClick={() => handleAvatarClick(p.id)}>
                        <Avatar
                          img={p.img}
                          name={p.name}
                          size={48}
                          speaking={p.speaking}
                          fireDistance={0.85}
                          depth={0.7}
                        />
                        <ScrollingName 
                          name={p.name}
                          className="text-[10px] w-full text-center" 
                          style={{ color: 'rgba(255,255,255,.65)' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </ListGroup>
            )}
          </div>
        )}
      </div>
      
      {/* Listeners Drawer */}
      <Drawer open={showListenersSheet} onOpenChange={setShowListenersSheet}>
        <DrawerContent className="border-none backdrop-blur-xl" style={{
          background: 'rgba(0,0,0,.50)',
          borderTop: '1px solid rgba(255,255,255,.08)'
        }}>
          <div className="px-4 pt-1 pb-2">
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,.92)' }}>
              Around the fire
            </div>
            <div className="text-[11px]" style={{ color: 'rgba(255,255,255,.55)' }}>
              {listeners.length} listening
            </div>
          </div>

          <div className="px-4 pb-4 overflow-y-auto max-h-[60vh]">
            <ListGroup title="Listeners">
              <div
                className="rounded-2xl p-3 backdrop-blur-sm"
                style={{
                  border: '1px solid rgba(255,255,255,.08)',
                  background: 'rgba(0,0,0,.10)',
                }}
              >
                <div className="grid grid-cols-4 gap-4">
                  {listenerPeople.map((p) => (
                    <div key={p.id} className="flex flex-col items-center gap-1" onClick={() => handleAvatarClick(p.id)}>
                      <Avatar
                        img={p.img}
                        name={p.name}
                        size={48}
                        speaking={p.speaking}
                        fireDistance={0.85}
                        depth={0.7}
                      />
                      <ScrollingName 
                        name={p.name}
                        className="text-[10px] w-full text-center" 
                        style={{ color: 'rgba(255,255,255,.65)' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </ListGroup>
          </div>
        </DrawerContent>
      </Drawer>
      
      {/* Avatar Context Menu (RTK) */}
      {selectedPeer && (
        <AvatarContextMenuRTK
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
      
      {/* Tipping Drawer */}
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

