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

export default function Header({ onToggleChat, isChatOpen = false }: HeaderProps) {
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const messages = useHMSStore(selectHMSMessages);
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
          <div className="flex items-center space-x-3">
            {onToggleChat && (
              <button
                onClick={onToggleChat}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                  isChatOpen 
                    ? 'bg-clubhouse-green text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Toggle chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {messages.length > 0 && !isChatOpen && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {messages.length > 9 ? '9+' : messages.length}
                  </div>
                )}
              </button>
            )}
            <button
              id="leave-btn"
              className="clubhouse-button clubhouse-button-danger flex items-center space-x-2"
              onClick={() => hmsActions.leave()}
            >
              <ExitIcon className="w-4 h-4" />
              <span>Leave Room</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
