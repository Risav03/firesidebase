'use client'

import { ExitIcon } from "@100mslive/react-icons";
import {
  selectIsConnectedToRoom,
  useHMSActions,
  useHMSStore,
} from "@100mslive/react-sdk";

export default function Header() {
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const hmsActions = useHMSActions();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-clubhouse-green rounded-2xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">🏠</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Clubhouse</h1>
        </div>
        {isConnected && (
          <button
            id="leave-btn"
            className="clubhouse-button clubhouse-button-danger flex items-center space-x-2"
            onClick={() => hmsActions.leave()}
          >
            <ExitIcon className="w-4 h-4" />
            <span>Leave Room</span>
          </button>
        )}
      </div>
    </header>
  );
}
