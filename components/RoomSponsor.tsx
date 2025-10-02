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
import { useActiveSponsor } from "@/utils/events";

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
  const { user } = useGlobalContext();
  const localPeer = useHMSStore(selectLocalPeer);
  const isHost = localPeer?.roleName === "host";
  
  // Track sponsorship countdown times on client
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  
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
      console.log("Fetching live sponsorships from server");
      const token = await getAuthToken();
      const response = await fetchLiveSponsorships(roomId, token);
      
      if (response.ok && response.data) {
        // Get sponsorships from the response
        const sponsorships = response.data.data || [];
        console.log(`Fetched Sponsorships: ${sponsorships.length}`, sponsorships);
        setLiveSponsorships(sponsorships);
        
        // Initialize countdown timers based on server values
        const initialCountdowns: Record<string, number> = {};
        sponsorships.forEach((sponsorship:any) => {
          initialCountdowns[sponsorship.id] = sponsorship.remainingTime;
        });
        setCountdowns(initialCountdowns);
      } else {
        console.error("Failed to fetch sponsorships:", response);
      }
    } catch (error) {
      console.error("Error fetching live sponsorships:", error);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, getAuthToken]);

  // Listen for active sponsor events and fetch sponsorships when triggered
  useActiveSponsor(() => {
    if(liveSponsorships.length === 0)
    fetchSponsors();
  });
  
  // Fetch sponsorships on component mount
  useEffect(() => {
    console.log("Initial sponsorship fetch on component mount");
    fetchSponsors();
  }, [fetchSponsors]);
  
  // Update countdowns every second and handle expiration
  useEffect(() => {
    if (Object.keys(countdowns).length === 0) return;
    
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const updated = { ...prev };
        let hasExpired = false;
        
        // Decrement all countdown times
        Object.entries(updated).forEach(([id, time]) => {
          updated[id] = Math.max(0, time - 1);
          if (updated[id] === 0) hasExpired = true;
        });
        
        // Check if any sponsorship expired
        if (hasExpired) {
          // Remove expired sponsorships from display
          setLiveSponsorships(current => {
            const active = current.filter(s => updated[s.id] > 0);
            
            // If all sponsorships expired, fetch to see if there are new ones
            if (active.length === 0) {
              console.log("All sponsorships expired, checking for new ones");
              fetchSponsors();
            }
            
            return active;
          });
        }
        
        return updated;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [countdowns, fetchSponsors]);
  
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
        <div className="w-screen absolute z-[10000] right-0 max-w-6xl mx-auto">
          {liveSponsorships.map((sponsorship) => (
            <div key={sponsorship.id} className="fixed bottom-28 left-0 w-screen overflow-hidden">
              {/* Sponsorship Banner */}
              <div className="w-full aspect-[5/1] relative">
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
                    countdowns[sponsorship.id] < 30 ? 'bg-red-500/60' : 'bg-black/60'
                  } text-white text-xs px-2 py-1 rounded-full transition-colors`}>
                    {formatRemainingTime(countdowns[sponsorship.id] || 0)} remaining
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="w-full max-w-6xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Sponsor Upload Button (Available to Everyone) - smaller when sponsorships are active */}
          <div 
            className={`md:w-1/3 py-4 aspect-auto bg-white/5 flex gap-3 text-white/30 font-bold items-center justify-center border-2 border-dashed border-white/30 bg-opacity-50 rounded-lg cursor-pointer hover:bg-white/10 transition-colors`}
            onClick={() => setIsSponsorDrawerOpen(true)}
          >
            <FaCirclePlus className="flex-shrink-0" />
            <span>Sponsor Fireside</span>
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
          
          // Check if sponsorship was activated and we have no active sponsorships
          if (sponsorshipData && liveSponsorships.length === 0) {
            console.log("Sponsorship activated and no active ones - fetching");
            fetchSponsors();
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