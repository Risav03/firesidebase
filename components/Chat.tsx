'use client'

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
  onClose: () => void;
}

export default function Chat({ isOpen, onClose }: ChatProps) {
  const [message, setMessage] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  
  const messages = useHMSStore(selectHMSMessages);
  const localPeer = useHMSStore(selectLocalPeer);
  const hmsActions = useHMSActions();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Debug: Log message structure
    if (messages.length > 0) {
      console.log('Latest message structure:', messages[messages.length - 1]);
      console.log('Local peer:', localPeer);
    }
  }, [messages, localPeer]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Keep chat within viewport bounds
      const chatElement = chatRef.current;
      if (chatElement) {
        const rect = chatElement.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragStart, position]);

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

  if (!isOpen) return null;

  const chatStyle = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    right: position.x === 0 && position.y === 0 ? '1rem' : 'auto',
    top: position.x === 0 && position.y === 0 ? '5rem' : 'auto',
  };

  return (
    <div 
      ref={chatRef}
      className={`chat-container ${isMinimized ? 'minimized' : ''}`}
      style={chatStyle}
    >
      {/* Chat Header */}
      <div 
        className={`chat-header ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-clubhouse-green rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-gray-900">Room Chat</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {messages.length}
          </span>
          {/* Drag handle indicator */}
          <div className="flex items-center space-x-1 opacity-40 ml-2">
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title={isMinimized ? "Expand chat" : "Minimize chat"}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMinimized ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              )}
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close chat"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 mb-1">No messages yet</p>
                <p className="text-xs text-gray-400">Start the conversation!</p>
              </div>
            ) : (
              <>
                {messages.map((msg: HMSMessage) => {
                  // Try multiple ways to get sender name for comparison
                  const msgSenderName = msg.senderName ||
                                       msg.sender || 
                                       (msg as any).senderUserId;
                  
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
          <div className="chat-input">
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-clubhouse-green focus:ring-2 focus:ring-clubhouse-green focus:ring-opacity-20 outline-none transition-all duration-200 text-sm resize-none"
                  maxLength={500}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="w-10 h-10 bg-clubhouse-green text-white rounded-full flex items-center justify-center transition-all duration-200 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                title="Send message"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            {message.length > 400 && (
              <div className="text-xs text-gray-500 mt-1 text-right">
                {message.length}/500
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
