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

  const handleSponsorClick = () => {
    if (!isHost) {
      setIsSponsorDrawerOpen(true);
    } else {
      setIsPendingDrawerOpen(true);
    }
  };

  return (
    <>
      <div className="w-full max-w-6xl mx-auto mb-6">
        <div 
          className="w-full bg-white/5 flex gap-3 text-white/30 font-bold items-center justify-center border-2 border-dashed border-white/30 bg-opacity-50 rounded-lg aspect-[3/1] cursor-pointer hover:bg-white/10 transition-colors"
          onClick={handleSponsorClick}
        >
          {isHost ? (
            <>
              <HiOutlineClipboardCheck size={20} />
              Manage Sponsorship Requests
            </>
          ) : (
            <>
              <FaCirclePlus />
              Sponsor the space
            </>
          )}
        </div>
      </div>
      
      {/* Drawer for regular users to submit sponsorships */}
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
