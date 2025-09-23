"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { RiLoader5Fill } from "react-icons/ri";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from "@/components/UI/drawer";
import sdk from "@farcaster/miniapp-sdk";
import { fetchPendingSponsorships, updateSponsorshipStatus } from "@/utils/serverActions";
import Image from "next/image";

interface PendingSponsorshipsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

interface SponsorInfo {
  fid: string;
  username: string;
  displayName: string;
  pfpUrl: string;
}

interface SponsorshipRequest {
  id: string;
  imageUrl: string;
  duration: number;
  status: string;
  roomId: string;
  sponsorId: string;
  createdAt: string;
  updatedAt: string;
  sponsor: SponsorInfo | null;
}

export default function PendingSponsorshipsDrawer({
  isOpen,
  onClose,
  roomId,
}: PendingSponsorshipsDrawerProps) {
  const [pendingRequests, setPendingRequests] = useState<SponsorshipRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  
  // Format time duration nicely
  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''}${mins > 0 ? ` ${mins} minute${mins !== 1 ? 's' : ''}` : ''}`;
    }
  };

  // Format date nicely
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  const loadPendingSponsorships = async () => {
    setIsLoading(true);
    try {
        const env = process.env.NEXT_PUBLIC_ENV;

        let token:any = null;
        if(env !== "DEV") {
          token = (await sdk.quickAuth.getToken()).token;
        }
      const result = await fetchPendingSponsorships(roomId, token);
      
      if (result.ok) {
        console.log("Pending and hasit",result.data)
        setPendingRequests(result.data.data);
      } else {
        console.error("Failed to fetch pending sponsorships:", result);
        toast.error("Failed to load pending sponsorship requests");
      }
    } catch (error) {
      console.error("Error loading pending sponsorships:", error);
      toast.error("Error loading pending sponsorship requests");
    } finally {
      setIsLoading(false);
    }
  };

  // Load pending sponsorships when drawer opens
  useEffect(() => {
    if (isOpen) {
      loadPendingSponsorships();
    }
  }, [isOpen, roomId]);

  const handleStatusUpdate = async (sponsorshipId: string, status: 'approved' | 'declined') => {
    // Mark this sponsorship as processing
    setProcessingIds(prev => new Set(prev).add(sponsorshipId));
    
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      
      let token:any = null;
      if(env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }
      
      const result = await updateSponsorshipStatus(sponsorshipId, status, token);
      
      if (result.ok) {
        toast.success(`Sponsorship ${status} successfully`);
        
        // Remove the processed sponsorship from the list
        setPendingRequests(prev => prev.filter(req => req.id !== sponsorshipId));
      } else {
        console.error(`Failed to ${status} sponsorship:`, result);
        toast.error(`Failed to ${status} sponsorship request`);
      }
    } catch (error) {
      console.error(`Error ${status}ing sponsorship:`, error);
      toast.error(`Error ${status}ing sponsorship request`);
    } finally {
      // Remove from processing set
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(sponsorshipId);
        return newSet;
      });
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-black/50 backdrop-blur-2xl text-white border-t border-fireside-orange/30 focus:outline-none">
        <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-fireside-orange/30"></div>
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-bold text-white">Pending Sponsorship Requests</DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-6 overflow-y-auto max-h-[70vh]">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <RiLoader5Fill className="animate-spin text-fireside-orange text-3xl" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              No pending sponsorship requests
            </div>
          ) : (
            <div className="space-y-6">
              {pendingRequests.map((request) => (
                <div key={request.id} className="bg-black/40 rounded-lg overflow-hidden border border-white/10 transition-all hover:border-fireside-orange/30">
                  <div className="relative w-full h-40">
                    <img 
                      src={request.imageUrl} 
                      alt="Sponsorship banner" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {request.sponsor?.pfpUrl && (
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                          <img 
                            src={request.sponsor.pfpUrl} 
                            alt={request.sponsor.displayName || request.sponsor.username} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <div className="font-bold">
                          {request.sponsor?.displayName || request.sponsor?.username || 'Unknown sponsor'}
                        </div>
                        {request.sponsor?.username && (
                          <div className="text-gray-400 text-sm">@{request.sponsor.username}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-300 mb-4">
                      <div>Duration: {formatDuration(request.duration)}</div>
                      <div>Requested: {formatDate(request.createdAt)}</div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'approved')}
                        disabled={processingIds.has(request.id)}
                        className={`flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold flex items-center justify-center gap-2 transition-all ${
                          processingIds.has(request.id) ? 'opacity-50 cursor-not-allowed' : 'hover:from-green-700 hover:to-green-600 hover:shadow-md'
                        }`}
                      >
                        {processingIds.has(request.id) ? <RiLoader5Fill className="animate-spin" /> : null}
                        Approve
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'declined')}
                        disabled={processingIds.has(request.id)}
                        className={`flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold flex items-center justify-center gap-2 transition-all ${
                          processingIds.has(request.id) ? 'opacity-50 cursor-not-allowed' : 'hover:from-red-700 hover:to-red-600 hover:shadow-md'
                        }`}
                      >
                        {processingIds.has(request.id) ? <RiLoader5Fill className="animate-spin" /> : null}
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}