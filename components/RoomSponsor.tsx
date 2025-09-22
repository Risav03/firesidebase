"use client";
import { useState } from "react";
import { FaCirclePlus } from "react-icons/fa6";
import { useHMSStore, selectLocalPeer } from "@100mslive/react-sdk";
import SponsorDrawer from "./SponsorDrawer";

export default function RoomSponsor({ roomId }: { roomId: string }) {
  const [isSponsorDrawerOpen, setIsSponsorDrawerOpen] = useState(false);
  const localPeer = useHMSStore(selectLocalPeer);
  const isHost = localPeer?.roleName === "host";

  const handleClick = () => {
    // if (!isHost) {
      setIsSponsorDrawerOpen(true);
    // } else {
    //   // If host clicks, maybe show a different UI or toast message
    //   console.log("Host clicked the sponsor area");
    // }
  };

  return (
    <>
      <div className="w-full max-w-6xl mx-auto mb-6">
        <div 
          className={`w-full bg-white/5 flex gap-3 text-white/30 font-bold items-center justify-center border-2 border-dashed border-white/30 bg-opacity-50 rounded-lg aspect-[3/1] ${!isHost ? 'cursor-pointer hover:bg-white/10 transition-colors' : ''}`}
          onClick={handleClick}
        >
          <FaCirclePlus />
          Sponsor the space
        </div>
      </div>
      
      <SponsorDrawer 
        isOpen={isSponsorDrawerOpen} 
        onClose={() => setIsSponsorDrawerOpen(false)} 
        roomId={roomId} 
      />
    </>
  );
}
