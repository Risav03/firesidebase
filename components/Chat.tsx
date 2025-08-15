"use client";

import { useState, useRef, useEffect } from "react";
import {
  selectHMSMessages,
  selectLocalPeer,
  useHMSActions,
  useHMSStore,
  HMSMessage,
} from "@100mslive/react-sdk";
import { ChatMessage } from "./ChatMessage";

interface ChatProps {
  isOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
}

export default function Chat({ isOpen, setIsChatOpen }: ChatProps) {
  const [message, setMessage] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const messages = useHMSStore(selectHMSMessages);
  const localPeer = useHMSStore(selectLocalPeer);
  const hmsActions = useHMSActions();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Debug: Log message structure
    if (messages.length > 0) {
      console.log("Latest message structure:", messages[messages.length - 1]);
      console.log("Local peer:", localPeer);
    }
  }, [messages, localPeer]);

  // Handle closing animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsChatOpen(false);
      setIsClosing(false);
    }, 400); // Match the CSS transition duration
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      hmsActions.sendBroadcastMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Always render, but control visibility through CSS classes
  const modalClass = `chat-modal ${isOpen ? 'open' : ''} ${isClosing ? 'closing' : ''}`;

  return (
    <div
      ref={chatRef}
      className={modalClass}
    >
      {/* Chat Header */}
      <div className="chat-content chat-header bg-gray-800 border-0 px-4 py-4 rounded-t-lg flex">
        <div className="flex items-center space-x-3 w-[50%]">
          <div className="w-3 h-3 bg-fireside-orange rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-white">Room Chat</h3>
          <span className="text-xs text-white bg-gray-700 px-2 py-1 rounded-full">
            {messages.length}
          </span>
        </div>
        <div className="flex items-center space-x-2 justify-end w-[50%]">
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close chat"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-content chat-messages bg-gray-950 min-h-[70vh] max-h-[70vh]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="text-sm text-white mb-1">No messages yet</p>
            <p className="text-xs text-gray-400">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg: HMSMessage) => {
              // Try multiple ways to get sender name for comparison
              const msgSenderName =
                msg.senderName || msg.sender || (msg as any).senderUserId;

              return (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isOwnMessage={msgSenderName === localPeer?.name}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Chat Input */}
      <div className="chat-content chat-input rounded-b-none bg-gray-800 border-0">
        <div className="flex items-end space-x-3">
          <div className="flex-1 items-center justify-center">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-4 py-3 bg-white/10 text-white rounded-2xl border border-white/50 focus:border-fireside-orange focus:ring-2 focus:ring-fireside-orange focus:ring-opacity-20 outline-none transition-all duration-200 text-base resize-none"
              maxLength={500}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!message.trim()}
            className="w-10 h-10 bg-fireside-orange text-white rounded-full flex items-center justify-center transition-all duration-200 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
            title="Send message"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
        {message.length > 400 && (
          <div className="text-xs text-gray-500 mt-1 text-right">
            {message.length}/500
          </div>
        )}
      </div>
    </div>
  );
}
