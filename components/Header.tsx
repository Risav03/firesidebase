'use client'

import { ExitIcon } from "@100mslive/react-icons";
import {
  selectIsConnectedToRoom,
  selectHMSMessages,
  selectLocalPeer,
  useHMSActions,
  useHMSStore,
} from "@100mslive/react-sdk";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface HeaderProps {
  onToggleChat?: () => void;
  isChatOpen?: boolean;
}

export default function Header({ onToggleChat, isChatOpen = false }: HeaderProps) {
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const messages = useHMSStore(selectHMSMessages);
  const localPeer = useHMSStore(selectLocalPeer);
  const hmsActions = useHMSActions();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshRole = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Trigger a page refresh to re-check roles
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing role:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 px-6 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10  rounded-2xl flex items-center justify-center">
            <Image src={`${process.env.NEXT_PUBLIC_URL}/fireside-logo.svg`} width={1080} height={1080} alt="Fireside Logo" className="text-white font-bold text-lg" />
          </div>
          <h1 className="text-xl font-bold text-white -translate-x-4">Fireside</h1>
          {localPeer?.roleName && (
            <span className="text-sm text-gray-400 px-2 py-1 bg-gray-800 rounded-md">
              {localPeer.roleName}
            </span>
          )}
        </div>
        {isConnected && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefreshRole}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm flex items-center space-x-2 transition-colors disabled:opacity-50"
              title="Refresh role permissions"
            >
              <svg 
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
              <span>Refresh</span>
            </button>
            <button
              id="leave-btn"
              className="px-4 py-2 rounded-lg clubhouse-button-danger flex items-center"
              onClick={() => {hmsActions.leave();
                router.push('/');
              }}
            >
              <ExitIcon className="w-6 h-6" />
              <span></span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
