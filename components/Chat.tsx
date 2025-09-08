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
import { useGlobalContext } from "@/utils/providers/globalContext";
import toast from "react-hot-toast";
import sdk from "@farcaster/miniapp-sdk";

interface ChatProps {
  isOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  roomId: string;
}

export default function Chat({ isOpen, setIsChatOpen, roomId }: ChatProps) {
  const [message, setMessage] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [redisMessages, setRedisMessages] = useState<RedisChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const messages = useHMSStore(selectHMSMessages);
  const localPeer = useHMSStore(selectLocalPeer);
  const hmsActions = useHMSActions();
  const { user } = useGlobalContext();

  useEffect(() => {
    const loadMessages = async () => {
      if (!roomId) return;

      setLoading(true);
      try {
        const URL = process.env.BACKEND_URL || 'http://localhost:8000';
        const env = process.env.NEXT_PUBLIC_ENV;
        
        var token: any = "";
        if (env !== "DEV") {
          token = await sdk.quickAuth.getToken();
        };

        const response = await fetch(`${URL}/api/rooms/public/${roomId}/messages?limit=50`, {
          // headers: {
          //   'Authorization': `Bearer ${token}`
          // }
        });
        const data = await response.json();
        console.log("Room messages response:", data);

        if (data.success) {
          setRedisMessages(data.data.messages);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [roomId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, redisMessages]);

  // Handle closing animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsChatOpen(false);
      setIsClosing(false);
    }, 400); // Match the CSS transition duration
  };

  const handleSendMessage = async () => {
    const URL = process.env.BACKEND_URL || 'http://localhost:8000';
    if (!message.trim() || !user?.fid) return;

    const messageText = message.trim();
    setMessage(""); // Clear input immediately

    try {
      // Send to HMS for real-time broadcast
      hmsActions.sendBroadcastMessage(messageText);

      const env = process.env.NEXT_PUBLIC_ENV;
        
        var token: any = "";
        if (env !== "DEV") {
          token = await sdk.quickAuth.getToken();
        };

      // Store in Redis for persistence
      const response = await fetch(`${URL}/api/rooms/protected/${roomId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: messageText,
          userFid: user.fid
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add the new message to our local state
        setRedisMessages(prev => [...prev, data.data.message]);
      } else {
        console.error('Failed to store message:', data.error);
        toast.error('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // toast.error('Error sending message. Please try again.');
      // Could show a retry option here
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper function to validate message structure
  const isValidMessageStructure = (msg: any): boolean => {
    if (!msg || typeof msg !== 'object') return false;
    
    // For Redis messages
    if ('timestamp' in msg && 'message' in msg && typeof msg.message === 'string') return true;
    
    // For HMS messages
    if ('time' in msg && 'message' in msg && typeof msg.message === 'string') return true;
    
    return false;
  };

  // Filter and combine messages
  const validRedisMessages = redisMessages.filter(isValidMessageStructure);
  const validHMSMessages = messages
    .filter(msg => {
      if (!isValidMessageStructure(msg)) return false;
      
      // Check if this message already exists in Redis
      return !validRedisMessages.some(redisMsg =>
        redisMsg.message === msg.message &&
        Math.abs(new Date(redisMsg.timestamp).getTime() - msg.time.getTime()) < 5000
      );
    })
    .map(hmsMsg => ({
      id: `hms_${hmsMsg.id}`,
      roomId: roomId,
      userId: hmsMsg.senderName || hmsMsg.sender || 'unknown',
      username: hmsMsg.senderName || hmsMsg.sender || 'Unknown',
      displayName: hmsMsg.senderName || hmsMsg.sender || 'Unknown',
      pfp_url: '',
      message: hmsMsg.message,
      timestamp: hmsMsg.time.toISOString(),
      type: 'text' as const
    }));

  const combinedMessages = [...validRedisMessages, ...validHMSMessages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Always render, but control visibility through CSS classes
  const modalClass = `chat-modal ${isOpen ? 'open' : ''} ${isClosing ? 'closing' : ''}`;

  console.log("Combined messages:", combinedMessages);
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
          {/* <span className="text-xs text-white bg-gray-700 px-2 py-1 rounded-full">
            {combinedMessages.length}
          </span> */}
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
      <div className="chat-content chat-messages bg-gray-100/5 backdrop-blur-sm min-h-[70vh] max-h-[70vh]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-white text-sm">Loading messages...</div>
          </div>
        ) : combinedMessages.length === 0 ? (
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
            {combinedMessages.map((msg) => {
              // For Redis messages, check against user fid; for HMS messages, check against peer name
              const isOwn = msg.userId === user?.fid || msg.userId === localPeer?.name;

              return (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isOwnMessage={isOwn}
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