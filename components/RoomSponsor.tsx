"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { FaCirclePlus } from "react-icons/fa6";
import { HiOutlineClipboardCheck } from "react-icons/hi";
import { useHMSStore, selectLocalPeer } from "@100mslive/react-sdk";
import SponsorDrawer from "./SponsorDrawer";
import PendingSponsorshipsDrawer from "./PendingSponsorshipsDrawer";
import { fetchLiveSponsorships } from "@/utils/serverActions";
import sdk from "@farcaster/miniapp-sdk";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useNewSponsorEvent } from "@/utils/events";

interface LiveSponsorship {
  id: string;
  imageUrl: string;
  remainingTime: number;
  roomId: string;
  sponsor: {
    fid: string;
    username: string;
    displayName: string;
    pfpUrl: string;
  } | null;
}

export default function RoomSponsor({ roomId }: { roomId: string }) {
  const [isSponsorDrawerOpen, setIsSponsorDrawerOpen] = useState(false);
  const [isPendingDrawerOpen, setIsPendingDrawerOpen] = useState(false);
  const [liveSponsorships, setLiveSponsorships] = useState<LiveSponsorship[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerId = useRef<NodeJS.Timeout | null>(null);
  const isRefetchQueued = useRef(false);
  const { user } = useGlobalContext();
  const localPeer = useHMSStore(selectLocalPeer);
  const isHost = localPeer?.roleName === "host";
  
  // Function to fetch auth token
  const getAuthToken = useCallback(async () => {
    let token: string | null = null;
    const env = process.env.NEXT_PUBLIC_ENV;
    
    if (env !== "DEV" && user?._id) {
      try {
        const authResult = await sdk.quickAuth.getToken();
        if (authResult && authResult.token) {
          token = authResult.token;
        }
      } catch (authError) {
        console.error("Auth error fetching token:", authError);
      }
    }
    
    return token;
  }, [user?._id]);
  
  // Function to fetch sponsorships
  const fetchSponsors = useCallback(async () => {
    if (!roomId) return;
    
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetchLiveSponsorships(roomId, token);
      
      if (response.ok && response.data) {
        const sponsorships = response.data.data || [];
        setLiveSponsorships(sponsorships);
        
        // If we have sponsorships with time left, start countdown timer
        if (sponsorships.length > 0 && !isTimerRunning) {
          startSponsorCountdown(sponsorships);
        }
      }
    } catch (error) {
      console.error("Error fetching live sponsorships:", error);
    } finally {
      setIsLoading(false);
      isRefetchQueued.current = false;
    }
  }, [roomId, isTimerRunning]);
  
  // Function to start countdown timer for sponsorships
  const startSponsorCountdown = useCallback((sponsorships: LiveSponsorship[]) => {
    // Clear any existing timer
    if (timerId.current) {
      clearTimeout(timerId.current);
      timerId.current = null;
    }
    
    if (sponsorships.length === 0) {
      setIsTimerRunning(false);
      return;
    }
    
    // Find the sponsorship with the smallest remaining time
    const shortestTTL = Math.min(...sponsorships.map(s => s.remainingTime));
    if (shortestTTL <= 0) {
      // If the shortest TTL is already expired, refetch in 2 seconds
      timerId.current = setTimeout(() => {
        fetchSponsors();
      }, 2000);
    } else {
      console.log(`Starting countdown timer for ${shortestTTL} seconds`);
      setIsTimerRunning(true);
      
      // Set timer to refetch after the sponsorship expires plus a 2-second delay
      timerId.current = setTimeout(() => {
        console.log("Timer expired, refetching sponsorships");
        fetchSponsors();
      }, (shortestTTL * 1000) + 2000);
    }
  }, [fetchSponsors]);
  
  // Listen for new sponsor events
  useNewSponsorEvent((msg) => {
    console.log("New sponsor event received:", msg);
    
    // Only refetch if we don't have a timer running
    if (!isTimerRunning && !isRefetchQueued.current) {
      console.log("Triggering refetch due to new sponsor event");
      isRefetchQueued.current = true;
      fetchSponsors();
    }
  });
  
  // Fetch live sponsorships on initial load and every 60 seconds as a fallback
  useEffect(() => {
    // Fetch immediately on mount
    fetchSponsors();
    
    // Set up interval to refresh every 60 seconds as a fallback
    const intervalId = setInterval(() => {
      if (!isTimerRunning && !isRefetchQueued.current) {
        fetchSponsors();
      }
    }, 60000);
    
    // Clean up interval and timer on unmount
    return () => {
      clearInterval(intervalId);
      if (timerId.current) {
        clearTimeout(timerId.current);
      }
    };
  }, [fetchSponsors, isTimerRunning]);

  // Add state to track sponsorships with local countdown
  const [localCountdowns, setLocalCountdowns] = useState<Record<string, number>>({});
  
  // Update local countdown every second
  useEffect(() => {
    if (liveSponsorships.length === 0) return;
    
    // Initialize local countdowns when sponsorships change
    const initialCountdowns: Record<string, number> = {};
    liveSponsorships.forEach(sponsorship => {
      initialCountdowns[sponsorship.id] = sponsorship.remainingTime;
    });
    setLocalCountdowns(initialCountdowns);
    
    // Update countdowns every second
    const countdownInterval = setInterval(() => {
      setLocalCountdowns(prev => {
        const updated: Record<string, number> = {};
        let allExpired = true;
        
        Object.entries(prev).forEach(([id, time]) => {
          const newTime = Math.max(0, time - 1);
          updated[id] = newTime;
          if (newTime > 0) allExpired = false;
        });
        
        return updated;
      });
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  }, [liveSponsorships]);
  
  // Format remaining time in a human-readable way
  const formatRemainingTime = (seconds: number) => {
    if (seconds <= 0) return "Expired";
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <>
      {/* Display active sponsorships if any exist */}
      {liveSponsorships.length > 0 && (
        <div className="w-full max-w-6xl mx-auto mb-6">
          {liveSponsorships.map((sponsorship) => (
            <div key={sponsorship.id} className="relative rounded-lg overflow-hidden mb-4">
              {/* Sponsorship Banner */}
              <div className="w-full aspect-[3/1] relative">
                <img 
                  src={sponsorship.imageUrl} 
                  alt="Sponsorship banner"
                  className="w-full h-full object-cover"
                />
                {/* Overlay with sponsor info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex justify-between items-end">
                  <div className="flex items-center gap-2">
                    {sponsorship.sponsor?.pfpUrl && (
                      <img 
                        src={sponsorship.sponsor.pfpUrl} 
                        alt={sponsorship.sponsor.displayName || sponsorship.sponsor.username}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="text-white text-sm">
                      Sponsored by {sponsorship.sponsor?.displayName || sponsorship.sponsor?.username || "Anonymous"}
                    </span>
                  </div>
                  <div className={`${
                    localCountdowns[sponsorship.id] < 30 ? 'bg-red-500/60' : 'bg-black/60'
                  } text-white text-xs px-2 py-1 rounded-full transition-colors`}>
                    {formatRemainingTime(localCountdowns[sponsorship.id] || sponsorship.remainingTime)} remaining
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="w-full max-w-6xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Sponsor Upload Button (Available to Everyone) */}
          <div 
            className="flex-1 bg-white/5 flex gap-3 text-white/30 font-bold items-center justify-center border-2 border-dashed border-white/30 bg-opacity-50 rounded-lg aspect-[3/1] cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => setIsSponsorDrawerOpen(true)}
          >
            <FaCirclePlus className="flex-shrink-0" />
            <span>Sponsor this space</span>
          </div>
          
          {/* Manage Sponsorships Button (Host Only) */}
          {isHost && (
            <div 
              className="md:w-1/3 bg-black/40 flex gap-3 text-fireside-orange/80 font-bold items-center justify-center border-2 border-dashed border-fireside-orange/30 rounded-lg py-4 cursor-pointer hover:bg-black/60 transition-colors"
              onClick={() => setIsPendingDrawerOpen(true)}
            >
              <HiOutlineClipboardCheck size={20} className="flex-shrink-0" />
              <span>Manage Requests</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Drawer for users to submit sponsorships */}
      <SponsorDrawer 
        isOpen={isSponsorDrawerOpen} 
        onClose={(sponsorshipData) => {
          setIsSponsorDrawerOpen(false);
          
          // Check if sponsorship was activated
          if (sponsorshipData) {
            console.log("Sponsorship activated:", sponsorshipData);
            
            // Update the UI immediately with the new sponsorship while waiting for server refresh
            if (!isRefetchQueued.current) {
              isRefetchQueued.current = true;
              fetchSponsors();
            }
          }
        }}
        roomId={roomId} 
      />
      
      {/* Drawer for hosts to manage pending sponsorships */}
      <PendingSponsorshipsDrawer
        isOpen={isPendingDrawerOpen}
        onClose={() => setIsPendingDrawerOpen(false)}
        roomId={roomId}
      />
    </>
  );
}
