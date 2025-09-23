"use client";
import { useState } from "react";
import { FaCirclePlus } from "react-icons/fa6";
import { HiOutlineClipboardCheck } from "react-icons/hi";
import { useHMSStore, selectLocalPeer } from "@100mslive/react-sdk";
import SponsorDrawer from "./SponsorDrawer";
import PendingSponsorshipsDrawer from "./PendingSponsorshipsDrawer";

export default function RoomSponsor({ roomId }: { roomId: string }) {
  const [isSponsorDrawerOpen, setIsSponsorDrawerOpen] = useState(false);
  const [isPendingDrawerOpen, setIsPendingDrawerOpen] = useState(false);
  const localPeer = useHMSStore(selectLocalPeer);
  const isHost = localPeer?.roleName === "host";

  return (
    <>
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
        onClose={() => setIsSponsorDrawerOpen(false)} 
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
