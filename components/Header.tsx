'use client'

import { ExitIcon } from "@100mslive/react-icons";
import {
  selectIsConnectedToRoom,
  selectHMSMessages,
  useHMSActions,
  useHMSStore,
  selectLocalPeer,
} from "@100mslive/react-sdk";
import { useState } from 'react';
import RoomEndModal from './RoomEndModal';

interface HeaderProps {
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  roomId?: string;
}
import Image from "next/image";
import { useRouter } from "next/navigation";
import FiresideLogo from "./UI/firesideLogo";

export default function Header({ onToggleChat, isChatOpen = false, roomId }: HeaderProps) {
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const messages = useHMSStore(selectHMSMessages);
  const hmsActions = useHMSActions();
  const router = useRouter();
  const localPeer = useHMSStore(selectLocalPeer);
  const [showRoomEndModal, setShowRoomEndModal] = useState(false);

  // Check if local user is host or co-host
  const isHostOrCoHost = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
  const isHost = localPeer?.roleName === 'host';

  const handleLeaveClick = () => {
    if (isHost) {
      // Broadcast custom event to end room for all participants except host
      hmsActions.sendBroadcastMessage(
        JSON.stringify({ type: "END_ROOM_EVENT", roomId })
      );
      setShowRoomEndModal(true);
    } else {
      // Direct leave for other roles
      hmsActions.leave();
      router.push('/');
    }
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
              <button
                id="leave-btn"
                className="px-2 py-1 rounded-lg clubhouse-button-danger flex items-center"
                onClick={handleLeaveClick}
              >
                <ExitIcon className="w-6 h-6" />
                <span></span>
              </button>
            </div>
          )}
        </div>
      </header>

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
