'use client'

import { ExitIcon } from "@100mslive/react-icons";
import {
  selectIsConnectedToRoom,
  selectHMSMessages,
  useHMSActions,
  useHMSStore,
} from "@100mslive/react-sdk";

interface HeaderProps {
  onToggleChat?: () => void;
  isChatOpen?: boolean;
}
import logo from "@/public/fireside-logo.svg"
import Image from "next/image";

export default function Header({ onToggleChat, isChatOpen = false }: HeaderProps) {
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const messages = useHMSStore(selectHMSMessages);
  const hmsActions = useHMSActions();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 px-6 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10  rounded-2xl flex items-center justify-center">
            <Image src={logo} alt="Fireside Logo" className="text-white font-bold text-lg" />
          </div>
          <h1 className="text-xl font-bold text-white -translate-x-4">Fireside</h1>
        </div>
        {isConnected && (
          <div className="flex items-center space-x-3">
            <button
              id="leave-btn"
              className="px-4 py-2 rounded-lg clubhouse-button-danger flex items-center"
              onClick={() => hmsActions.leave()}
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
