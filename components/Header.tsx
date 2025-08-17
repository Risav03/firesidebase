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
      // Show modal for host
      setShowRoomEndModal(true);
    } else {
      // Direct leave for other roles
      hmsActions.leave();
      router.push('/');
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10  rounded-2xl flex items-center justify-center">
              <Image src={`${process.env.NEXT_PUBLIC_URL}/fireside-logo.svg`} width={1080} height={1080} alt="Fireside Logo" className="text-white font-bold text-lg" />
            </div>
            <h1 className="text-xl font-bold text-white -translate-x-4">Fireside</h1>
          </div>
          {isConnected && (
            <div className="flex items-center space-x-3">
              <button
                id="leave-btn"
                className="px-4 py-2 rounded-lg clubhouse-button-danger flex items-center"
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
