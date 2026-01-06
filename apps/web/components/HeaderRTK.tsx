'use client'

/**
 * HeaderRTK - RealtimeKit version of Header
 * 
 * Key changes from 100ms version:
 * - Uses useRealtimeKit() context instead of useHMSActions
 * - Uses useConnectionState() instead of selectIsConnectedToRoom
 * - Uses useLocalParticipant() instead of selectLocalPeer
 * - Uses meeting.leave() for leaving
 * - Uses meeting.participants.kickAll() for ending room (host)
 */

import { useState } from 'react';
import { useRealtimeKit } from "@/utils/providers/realtimekit";
import { 
  useConnectionState, 
  useLocalParticipant,
  useParticipantActions 
} from "@/utils/providers/realtimekit-hooks";
import { TbShare3 } from "react-icons/tb";
import { MdCopyAll, MdOutlineIosShare } from "react-icons/md";
import { FaXTwitter } from "react-icons/fa6";
import { sdk } from "@farcaster/miniapp-sdk";
import { toast } from "react-toastify";
import Button from '@/components/UI/Button';
import { StarRings } from "./experimental";
import { useRouter } from "next/navigation";
import FiresideLogo from "./UI/firesideLogo";
import { IoExitOutline } from "react-icons/io5";

interface HeaderRTKProps {
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  roomId?: string;
}

export default function HeaderRTK({ onToggleChat, isChatOpen = false, roomId }: HeaderRTKProps) {
  const { meeting, leaveRoom } = useRealtimeKit();
  const isConnected = useConnectionState(meeting);
  const localParticipant = useLocalParticipant(meeting);
  const { kickAll } = useParticipantActions(meeting);
  const router = useRouter();

  const [showRoomEndModal, setShowRoomEndModal] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

  // Check if user is host based on preset
  const isHost = localParticipant?.presetName?.toLowerCase() === 'host';

  const handleLeaveClick = async () => {
    if (isHost) {
      setShowRoomEndModal(true);
    } else {
      // Direct leave for other roles
      await leaveRoom();
      router.push('/');
    }
  };

  // Handle ending room for everyone (host only)
  // Note: "End room for all" should use kickAll(), not meeting.leave()
  // This is exposed for use by RoomEndModalRTK
  const handleEndRoom = async () => {
    try {
      // Kick all participants first
      await kickAll();
      // Then leave
      await leaveRoom();
      router.push('/');
    } catch (err) {
      console.error('[RTK] Error ending room:', err);
      // Still try to leave even if kickAll fails
      await leaveRoom();
      router.push('/');
    }
  };

  // Simple leave for non-hosts
  const handleSimpleLeave = async () => {
    await leaveRoom();
    router.push('/');
  };

  async function composeCast() {
    try {
      await sdk.actions.composeCast({
        text: `Come join the conversation on Farcaster https://farcaster.xyz/miniapps/mMg32-HGwt1Y/fireside/call/${roomId}`,
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-fireside-darkOrange px-6 h-16 my-auto relative overflow-hidden">
        {/* Background visual effect */}
        <div className="absolute -top-10 -right-10 pointer-events-none opacity-30">
          <StarRings />
        </div>
        
        <div className="max-w-7xl h-full mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-start justify-start space-x-4">
            <FiresideLogo className="w-32 justify-start"/>
          </div>
          {isConnected && (
            <div className="flex items-center space-x-3">
              {roomId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsShareMenuOpen((prev) => !prev)}
                  className="relative z-50 flex items-center space-x-2"
                  title="Share"
                >
                  <TbShare3 className="w-5 h-5" />
                </Button>
              )}
              <Button
                id="leave-btn"
                variant="ghost"
                size="sm"
                className="bg-fireside-red px-2 py-1 flex items-center"
                onClick={handleLeaveClick}
              >
                <IoExitOutline className="w-6 h-6" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Share Menu Overlay */}
      <div onClick={() => setIsShareMenuOpen(false)} className={`fixed top-0 left-0 h-screen w-screen bg-black/30 duration-200 z-[1000] ${isShareMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        {isShareMenuOpen && (
          <div className="absolute right-4 top-16 border border-white/10 mb-2 w-40 bg-gray-800 text-white rounded-lg ">
            <Button
              variant="ghost"
              onClick={() => {
                setIsShareMenuOpen(false);
                composeCast();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-none rounded-t-lg shadow-none"
            >
              <MdOutlineIosShare className="w-5 h-5" />
              <span>Share on App</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsShareMenuOpen(false);
                handleShareOnTwitter();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-none shadow-none"
            >
              <FaXTwitter className="w-5 h-5" />
              <span>Share on X</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsShareMenuOpen(false);
                handleCopyURL();
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center space-x-2 rounded-none rounded-b-lg shadow-none"
            >
              <MdCopyAll className="w-5 h-5" />
              <span>Copy URL</span>
            </Button>
          </div>
        )}
      </div>

      {/* Room End Confirmation for RTK */}
      {showRoomEndModal && roomId && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-white font-semibold text-lg mb-2">End Room?</h3>
            <p className="text-gray-400 text-sm mb-6">
              This will end the room for all participants and cannot be undone.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleEndRoom}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                End Room for Everyone
              </button>
              <button
                onClick={handleSimpleLeave}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Just Leave
              </button>
              <button
                onClick={() => setShowRoomEndModal(false)}
                className="w-full px-4 py-3 bg-white/10 text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

