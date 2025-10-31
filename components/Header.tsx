'use client'

import { MdLogout } from "react-icons/md";
import { useState } from 'react';
import RoomEndModal from './RoomEndModal';
import { TbShare3 } from "react-icons/tb";
import { MdCopyAll, MdOutlineIosShare } from "react-icons/md";
import { FaXTwitter } from "react-icons/fa6";
import { sdk } from "@farcaster/miniapp-sdk";
import { toast } from "react-toastify";

interface HeaderProps {
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  roomId?: string;
}
import Image from "next/image";
import { useRouter } from "next/navigation";
import FiresideLogo from "./UI/firesideLogo";

export default function Header({ onToggleChat, isChatOpen = false, roomId }: HeaderProps) {
  const isConnected = true;
  const router = useRouter();
  const localPeer: any = null;
  const [showRoomEndModal, setShowRoomEndModal] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

  // Check if local user is host or co-host
  const isHostOrCoHost = false;
  const isHost = false;

  const handleLeaveClick = () => {
    if (isHost) {
      setShowRoomEndModal(true);
    } else {
      // Direct leave for other roles
      router.push('/');
    }
  };

  async function composeCast() {
    try {
      await sdk.actions.composeCast({
        text: `I've just sparked up a Fireside! Come join the conversation https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside/call/${roomId}`,
        embeds: [`https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside/call/${roomId}`],
      });
    } catch (e) {
      console.error("Error composing cast:", e);
    }
  }

  const handleCopyURL = () => {
    const roomURL = `https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside/call/${roomId}`;
    navigator.clipboard.writeText(roomURL).then(() => {
      toast.success("Room URL copied to clipboard!");
    }).catch((error) => {
      console.error("Failed to copy URL:", error);
      toast.error("Failed to copy URL to clipboard");
    });
  };

  const handleShareOnTwitter = () => {
    const roomURL = `https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside/call/${roomId}`;
    const text = "I've just sparked up a Fireside! Come join the conversation";
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(roomURL)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-black px-6 h-16 my-auto border-b border-white/20">
        <div className="max-w-7xl h-full mx-auto flex items-center justify-between">
          <div className="flex items-start justify-start space-x-4">
            <FiresideLogo className="w-32 justify-start"/>
          </div>
          {isConnected && (
            <div className="flex items-center space-x-3">
              {roomId && (
                <button
                  onClick={() => setIsShareMenuOpen((prev) => !prev)}
                  className="text-white relative z-50 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 flex items-center space-x-2"
                  title="Share"
                >
                  <TbShare3 className="w-5 h-5" />
                  <span className="text-sm">Share</span>
                </button>
              )}
              <button
                id="leave-btn"
                className="px-2 py-1 rounded-lg clubhouse-button-danger flex items-center"
                onClick={handleLeaveClick}
              >
                <MdLogout className="w-6 h-6" />
                <span></span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Share Menu Overlay */}
      <div onClick={() => setIsShareMenuOpen(false)} className={`fixed top-0 left-0 h-screen w-screen bg-black/30 duration-200 z-50 ${isShareMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        {isShareMenuOpen && (
          <div className="absolute right-4 top-16 border border-white/10 mb-2 w-40 bg-gray-800 text-white rounded-lg shadow-lg">
            <button
              onClick={() => {
                setIsShareMenuOpen(false);
                composeCast();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2"
            >
              <MdOutlineIosShare className="w-5 h-5" />
              <span>Share on App</span>
            </button>
            <button
              onClick={() => {
                setIsShareMenuOpen(false);
                handleShareOnTwitter();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2"
            >
              <FaXTwitter className="w-5 h-5" />
              <span>Share on X</span>
            </button>
            <button
              onClick={() => {
                setIsShareMenuOpen(false);
                handleCopyURL();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2"
            >
              <MdCopyAll className="w-5 h-5" />
              <span>Copy URL</span>
            </button>
          </div>
        )}
      </div>

      {/* Room End Modal */}
      {showRoomEndModal && roomId && (
        <RoomEndModal
          isVisible={showRoomEndModal}
          onClose={() => setShowRoomEndModal(false)}
          roomId={roomId}
        />
      )}
    </>
  );
}
