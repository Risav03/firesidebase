"use client";
import { useSpeakerRequestEvent, useSpeakerRejectionEvent, useNewSponsorEvent, useSponsorStatusEvent } from "@/utils/events";
import PeerWithContextMenu from "./PeerWithContextMenu";
import RoomSponsor from "./RoomSponsor";
import { useEffect, useState, useRef, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useRtmClient } from "@/utils/providers/rtm";
import RoomEndScreen from "./RoomEndScreen";
import { toast } from "react-toastify";
import { fetchRoomDetails, endRoom, fetchLiveParticipants } from "@/utils/serverActions";
import { showSponsorshipRequestToast, showSponsorStatusToast } from "@/utils/customToasts";
import SpeakerRequestsDrawer from "./SpeakerRequestsDrawer";
import PendingSponsorshipsDrawer from "./PendingSponsorshipsDrawer";
import SponsorDrawer from "./SponsorDrawer";
// import AudioRecoveryBanner from "./AudioRecoveryBanner";


export default function Conference({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { user } = useGlobalContext();
  const { channel } = useRtmClient();


  // Ref to track previous peers for empty room detection
  const previousPeersRef = useRef<any[]>([]);

  // Local state for optimistic updates
  const [peers, setPeers] = useState<any[]>([]);
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
  const [refreshKey, setRefreshKey] = useState(0);

  //function to fetch room details and save name and description in a useState. Call the function in useEffect
  const [roomDetails, setRoomDetails] = useState<{ name: string; description: string, sponsorshipEnabled: boolean } | null>(null);
  

   const handleSpeakerRequest = (event: any) => {
      // Extract peer ID from the event
      const peerId = event.peerId || (event.detail && event.detail.peerId);
      
      console.log("[Event - Conference] Speaker request received", {
        peerId,
        event,
        localRole: undefined,
        timestamp: new Date().toISOString(),
      });
      
      if (!peerId) {
        console.error("[HMS Event - Conference] Speaker request missing peer ID", event);
        return;
      }
      
      // Only hosts and co-hosts should see requests
      const me = peers.find(p => String(JSON.parse(p.metadata || '{}')?.fid || '') === String(user?.fid || ''));
      if (me?.roleName === 'host' || me?.roleName === 'co-host') {
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
          const peer = peers.find(p => p.id === peerId);
          if (peer && peer.name) {
            newRequest.peerName = peer.name;
          }
          
          // Add the new request
          return [...prevRequests, newRequest];
        });
        
        // Show toast notification with the peer name if available
        const peer = peers.find(p => p.id === peerId);
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
    // Convert the message to our expected event format
    handleSpeakerRequest({ peerId: msg.peer });
  });


  // RTM hand raise handled below


  useEffect(() => {
    if (!channel) return;
    const handler = ({ text }: any) => {
      try {
        const data = JSON.parse(text);
        if (data?.type === 'HAND_RAISE_CHANGED' && data?.payload?.userFid) {
          const fid = String(data.payload.userFid);
          // Ignore own RTM echo; local UI already updated
          if (String(user?.fid || '') === fid) return;
          const raised = Boolean(data.payload.raised);
          if (raised) toast(`${fid} raised their hand.`, { autoClose: 3000 });
          setPeers(prev => prev.map(p => {
            try {
              const md = p.metadata ? JSON.parse(p.metadata) : {};
              if (String(md?.fid || '') === fid) {
                return { ...p, handRaised: raised };
              }
            } catch {}
            return p;
          }));
        } else if (data?.type === 'ROOM_ENDED') {
          setRoomEnded(true);
        } else if (data?.type === 'MUTE_STATE' && data?.payload?.username !== undefined) {
          const uname = String(data.payload.username);
          // Ignore own RTM echo; local UI already updated
          if (String(user?.username || '') === uname) return;
          const muted = Boolean(data.payload.muted);
          setPeers(prev => prev.map(p => p.id === uname ? { ...p, muted } : p));
        } else if (data?.type === 'ROLE_SYNC' && (data?.payload?.username || data?.payload?.fid)) {
          const uname = String(data?.payload?.username || '');
          const fid = String(data?.payload?.fid || '');
          const role = String(data?.payload?.role || '').toLowerCase();
          if (role) {
            setPeers(prev => prev.map(p => {
              if (uname && p.id === uname) return { ...p, roleName: role };
              try {
                const md = p.metadata ? JSON.parse(p.metadata) : {};
                if (fid && String(md?.fid || '') === fid) return { ...p, roleName: role };
              } catch {}
              return p;
            }));
          }
        } else if (data?.type === 'EMOJI' && data?.payload?.emoji) {
          // no-op here; emoji handled in Footer for local animation
        } else if (data?.type === 'USER_JOINED' || data?.type === 'USER_LEFT') {
          // trigger immediate refresh of live participants
          setRefreshKey((k) => k + 1);
        }
      } catch {}
    };
    channel.on('ChannelMessage', handler);
    return () => { try { channel.off('ChannelMessage', handler); } catch {} };
  }, [channel]);

  // Local-only UI sync for events that Agora might not echo back to sender
  useEffect(() => {
    const onLocalMute = (e: any) => {
      try {
        const uname = String(e?.detail?.username || '');
        const muted = Boolean(e?.detail?.muted);
        if (!uname) return;
        setPeers(prev => prev.map(p => p.id === uname ? { ...p, muted } : p));
      } catch {}
    };
    const onLocalHandRaise = (e: any) => {
      try {
        const fid = String(e?.detail?.fid || '');
        const uname = String(e?.detail?.username || '');
        const raised = Boolean(e?.detail?.raised);
        setPeers(prev => prev.map(p => {
          try {
            if (uname && p.id === uname) return { ...p, handRaised: raised };
            const md = p.metadata ? JSON.parse(p.metadata) : {};
            if (fid && String(md?.fid || '') === fid) return { ...p, handRaised: raised };
          } catch {}
          return p;
        }));
      } catch {}
    };
    window.addEventListener('mute_state_local', onLocalMute as EventListener);
    window.addEventListener('hand_raise_local', onLocalHandRaise as EventListener);
    return () => {
      window.removeEventListener('mute_state_local', onLocalMute as EventListener);
      window.removeEventListener('hand_raise_local', onLocalHandRaise as EventListener);
    };
  }, []);

  // Active speaker UI: listen to volume indicators and mark speaking briefly
  useEffect(() => {
    const onVolume = (e: any) => {
      try {
        const uname = String(e?.detail?.username || '');
        const level = Number(e?.detail?.level || 0);
        if (!uname) return;
        const isSpeaking = level > 5; // threshold
        if (!isSpeaking) return;
        setPeers(prev => prev.map(p => p.id === uname ? { ...p, speaking: true } : p));
        // Decay after 300ms
        setTimeout(() => {
          setPeers(prev => prev.map(p => p.id === uname ? { ...p, speaking: false } : p));
        }, 300);
      } catch {}
    };
    window.addEventListener('volume_indicator', onVolume as EventListener);
    return () => window.removeEventListener('volume_indicator', onVolume as EventListener);
  }, []);


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
    const me = peers.find(p => String(JSON.parse(p.metadata || '{}')?.fid || '') === String(user?.fid || ''));
    if (!me || me.roleName !== 'host' || isEndingRoom) return;

    try {
      setIsEndingRoom(true);

      // Call API to end the room (skip if in test mode)
      if (!user?._id) {
        console.log('[Conference] Test mode: skipping room end API call');
        router.push('/');
        return;
      }
      const response = await endRoom(roomId, user._id);

      if (!response.ok) {
        console.error('Failed to end empty room:', response.data.error);
        setIsEndingRoom(false);
        return;
      }

      router.push('/');
    } catch (error) {
      console.error('Error ending empty room:', error);
      setIsEndingRoom(false);
    }
  }, [roomId, user, isEndingRoom, router, peers]);


  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const resp = await fetchLiveParticipants(roomId);
        const peersList = resp?.data?.result?.peers || resp?.data?.data?.peers;
        if (resp.ok && Array.isArray(peersList)) {
          const mapped = peersList
            .map((p: any) => {
              const username = String(p?.id ?? p?.user_id ?? p?.username ?? p?.userId ?? '').trim();
              if (!username) return null;
              const displayName = String(p?.displayName ?? p?.name ?? username);
              const avatar = String(p?.pfp_url || '');
              const roleName = String(p?.role || 'listener').toLowerCase();
              const isLocal = username === String(user?.username || '');
              const base: any = {
                id: username,
                name: displayName,
                roleName,
                isLocal,
                metadata: JSON.stringify({ avatar, username, fid: String(p?.userFid || p?.fid || '') }),
              };
              return base;
            })
            .filter(Boolean) as any[];

          // Drop placeholder/numeric echoes and duplicate local entries (by fid)
          const localUsername = String(user?.username || '');
          const localFid = String(user?.fid || '');
          const filtered = mapped.filter((m: any) => {
            try {
              const md = m.metadata ? JSON.parse(m.metadata) : {};
              const fid = String(md?.fid || '');
              const idIsNumeric = /^\d+$/.test(String(m.id || ''));
              const nameIsPlaceholder = /^User\s+\d+$/.test(String(m.name || ''));
              // If this entry represents the local fid but not the canonical username id, drop it
              if (fid && fid === localFid && m.id !== localUsername) return false;
              // Drop obvious numeric placeholders
              if (idIsNumeric || nameIsPlaceholder) return false;
            } catch {}
            return true;
          });

          setPeers((prev) => {
            // Deduplicate by id first
            const unique = Array.from(new Map(filtered.map((m: any) => [m.id, m])).values());

            // Build lookup maps from previous state for merging flags
            const prevById = new Map(prev.map(p => [p.id, p]));
            const prevByFid = new Map(
              prev.map(p => {
                try {
                  const md = p.metadata ? JSON.parse(p.metadata) : {};
                  return [String(md?.fid || ''), p];
                } catch {
                  return ['', p];
                }
              })
            );

            // Merge flags from previous state
            unique.forEach((m: any) => {
              const md = (() => { try { return m.metadata ? JSON.parse(m.metadata) : {}; } catch { return {}; } })();
              const fid = String(md?.fid || '');
              const existing = prevById.get(m.id) || (fid ? prevByFid.get(fid) : undefined);
              if (existing) {
                if (typeof existing.muted === 'boolean') m.muted = existing.muted;
                if (typeof (existing as any).handRaised === 'boolean') m.handRaised = (existing as any).handRaised;
              }
            });

            // Apply local override for role from localStorage
            try {
              if (typeof window !== 'undefined') {
                const storedRole = window.localStorage.getItem(`fireside_role_${roomId}`);
                if (storedRole) {
                  unique.forEach((m: any) => {
                    if (m.isLocal) m.roleName = String(storedRole).toLowerCase();
                  });
                }
              }
            } catch {}

            const currentPeers = unique.filter((mp: any) => !removedPeers.has(mp.id));
            const rolePriority: { [key: string]: number } = { 'host': 1, 'co-host': 2, 'speaker': 3, 'listener': 4 };
            const sortedPeers = currentPeers.sort((a: any, b: any) => {
              const roleA = a.roleName?.toLowerCase() || 'listener';
              const roleB = b.roleName?.toLowerCase() || 'listener';
              return (rolePriority[roleA] || 5) - (rolePriority[roleB] || 5);
            });
            // Update previous ref (best-effort)
            try { previousPeersRef.current = sortedPeers; } catch {}
            return sortedPeers;
          });

          // Optional empty-room handling disabled to avoid loops
          // if (currentPeers.length === 0 && previousPeersRef.current.length > 0) {
          //   setTimeout(() => {
          //     if (peers.length === 0) handleEmptyRoom();
          //   }, 10000);
          // }
          // previousPeersRef.current updated in setPeers above
        }
      } catch (e) {
        console.error('Failed to load participants', e);
      }
    };

    loadParticipants();
    const interval = setInterval(loadParticipants, 5000);
    return () => clearInterval(interval);
  }, [roomId, removedPeers, user?.fid, refreshKey]);

  // Listen for immediate refresh requests from CallClient (fallback if RTM isn’t ready yet)
  useEffect(() => {
    const onRefresh = (e: any) => {
      if (!e?.detail?.roomId || String(e.detail.roomId) !== String(roomId)) return;
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener('participants_refresh', onRefresh as EventListener);
    return () => window.removeEventListener('participants_refresh', onRefresh as EventListener);
  }, [roomId]);

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
    console.log("[HMS Event - Conference] Speaker rejection event received", {
      peer: msg.peer,
      timestamp: new Date().toISOString(),
    });
    handleRejectRequest({peerId: msg.peer});
  });

  // Listen for new sponsorship requests and show a toast to admins
  useNewSponsorEvent((msg) => {
    console.log("[HMS Event - Conference] New sponsor event received", {
      sponsorName: msg.sponsorName,
      localRole: undefined,
      timestamp: new Date().toISOString(),
    });
    
    // Only show the notification to hosts
    const me = peers.find(p => String(JSON.parse(p.metadata || '{}')?.fid || '') === String(user?.fid || ''));
    if (me?.roleName === 'host') {
      showSponsorshipRequestToast(msg.sponsorName, () => {
        toast.dismiss();
        setShowPendingSponsorshipsDrawer(true);
      });
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
    console.log("[HMS Event - Conference] Sponsor status event received", {
      status: msg.status,
      userId: msg.userId,
      userFid: user?.fid,
      timestamp: new Date().toISOString(),
    });
    
    // Check if the userId matches the current user's ID (skip if no user)
    if (user?.fid && (Number(user.fid) === Number(msg.userId))) {
      showSponsorStatusToast(msg.status, () => {
        if (msg.status === "approved") {
          setShowSponsorDrawer(true);
        }
        toast.dismiss();
      });
    }
  });

  if(roomEnded){
    return <RoomEndScreen onComplete={() => router.push("/")} />
  }
  else{
    // Only show speaker requests button for hosts and co-hosts
    const me = peers.find(p => String(JSON.parse(p.metadata || '{}')?.fid || '') === String(user?.fid || ''));
    const canManageSpeakers = me?.roleName === 'host' || me?.roleName === 'co-host';
    
    return (
      <div className="pt-20 pb-32 px-6 relative">
        {/* <AudioRecoveryBanner /> */}
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
              {(() => {
                const me = peers.find(p => p.isLocal);
                const meRole = me?.roleName;
                return peers.map((peer) => (
                  <PeerWithContextMenu key={peer.id} peer={peer} meRole={meRole} />
                ));
              })()}
            </div>
  
            {/* Screen share removed for audio-only scope */}
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
        {(() => {
          const me = peers.find(p => String(JSON.parse(p.metadata || '{}')?.fid || '') === String(user?.fid || ''));
          return me?.roleName === 'host';
        })() && (
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
