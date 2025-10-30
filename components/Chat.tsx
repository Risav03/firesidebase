"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRtmClient } from "@/utils/providers/rtm";
import { ChatMessage } from "./ChatMessage";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import { MdClose, MdSend } from 'react-icons/md';
import { fetchChatMessages, sendChatMessage } from "@/utils/serverActions";

interface ChatProps {
  isOpen: boolean;
  setIsChatOpen: () => void;
  roomId: string;
}

export default function Chat({ isOpen, setIsChatOpen, roomId }: ChatProps) {
  const [message, setMessage] = useState("");
  const [redisMessages, setRedisMessages] = useState<RedisChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { client: rtmClient, channel } = useRtmClient();
  const { user } = useGlobalContext();

  // Scroll to bottom function
  const scrollToBottom = useCallback((immediate = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: immediate ? "auto" : "smooth",
        block: "end"
      });
    }
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      if (!roomId) return;

      setLoading(true);
      try {
        const env = process.env.NEXT_PUBLIC_ENV;
        
        var token: any = "";
        if (env !== "DEV") {
          token = (await sdk.quickAuth.getToken()).token;
        };

        const response = await fetchChatMessages(roomId, 50);
        if (response.data.success) {
          const msgs = (response.data.data?.messages || []).map((m: any) => ({
            id: m.id || m._id || `${m.userId || m.userFid}_${m.timestamp || m.createdAt || Date.now()}`,
            roomId: m.roomId || roomId,
            userId: String(m.userId || m.userFid || ''),
            username: String(m.username || ''),
            displayName: String(m.displayName || m.name || m.username || 'Anonymous'),
            pfp_url: String(m.pfp_url || ''),
            message: String(m.message || m.text || ''),
            timestamp: new Date(m.timestamp || m.createdAt || m.ts || Date.now()).toISOString(),
          }));
          setRedisMessages(msgs);
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
    scrollToBottom();
  }, [redisMessages, scrollToBottom]);

  // Scroll to bottom when chat drawer opens
  useEffect(() => {
    if (isOpen) {
      // Multiple attempts to ensure scroll works after drawer animation
      setTimeout(() => scrollToBottom(true), 50);   // Immediate scroll
      setTimeout(() => scrollToBottom(), 200);      // After drawer animation
      setTimeout(() => scrollToBottom(), 500);      // Final fallback
    }
  }, [isOpen, scrollToBottom]);

  // Scroll to bottom when messages are loaded
  useEffect(() => {
    if (isOpen && !loading && (redisMessages.length > 0)) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [isOpen, loading, redisMessages.length, scrollToBottom]);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // Maximum height in pixels (roughly 4-5 lines)
      const minHeight = 48; // Minimum height in pixels
      
      if (scrollHeight <= maxHeight) {
        textarea.style.height = `${Math.max(scrollHeight, minHeight)}px`;
        textarea.style.overflowY = 'hidden';
      } else {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      }
    }
  };

  // Adjust height when message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleSendMessage = async () => {
    const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    if (!message.trim() || !user?.fid) return;

    const messageText = message.trim();
    setMessage(""); // Clear input immediately
    
    // Reset textarea height after clearing message
    setTimeout(() => {
      adjustTextareaHeight();
    }, 0);

    try {
      // Send to RTM for real-time broadcast (include sender metadata for correct UI on receivers)
      if (channel) {
        const envelope = { 
          type: 'CHAT', 
          payload: { 
            text: messageText, 
            userFid: user.fid,
            username: String(user.username || ''),
            displayName: String(user.displayName || user.username || ''),
            pfp_url: String(user.pfp_url || '')
          }, 
          ts: Date.now() 
        };
        await channel.sendMessage({ text: JSON.stringify(envelope) });
      }

      const env = process.env.NEXT_PUBLIC_ENV;
        
      var token: any = "";
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      };

      // Store in Redis for persistence
      const response = await sendChatMessage(
        roomId,
        {
          message: messageText,
          userFid: user.fid
        },
        token
      );

      if (response.data.success) {
        // Normalize and add the new message to our local state (avoid Anonymous/invalid time before refresh)
        const m = response.data.data.message || {};
        const normalized: RedisChatMessage = {
          id: m.id || m._id || `${user.fid}_${Date.now()}`,
          roomId: m.roomId || roomId,
          userId: String(m.userId || m.userFid || user.fid || ''),
          username: String(m.username || user.username || ''),
          displayName: String(m.displayName || user.displayName || user.username || 'Anonymous'),
          pfp_url: String(m.pfp_url || user.pfp_url || ''),
          message: String(m.message || m.text || messageText),
          timestamp: new Date(m.timestamp || m.createdAt || m.ts || Date.now()).toISOString(),
        } as any;
        setRedisMessages(prev => [...prev, normalized]);
      } else {
        console.error('Failed to store message:', response.data.error);
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

  // Calculate dynamic height
  const getMessagesHeight = () => {
    return '55vh';
  };

  // Helper function to validate message structure
  const isValidMessageStructure = (msg: any): boolean => {
    if (!msg || typeof msg !== 'object') return false;
    
    // For Redis messages
    if ('timestamp' in msg && 'message' in msg && typeof msg.message === 'string') return true;
    
    // For HMS messages
    if ('time' in msg && 'message' in msg) {
      // Check if the message is a JSON string containing our metadata
      try {
        const parsedMessage = JSON.parse(msg.message);
        return typeof parsedMessage === 'object' && 'text' in parsedMessage;
      } catch (e) {
        // If it's not parseable as JSON, check if it's a plain string message
        return typeof msg.message === 'string';
      }
    }
    
    return false;
  };

  // RTM live message list
  const [liveMessages, setLiveMessages] = useState<RedisChatMessage[]>([]);

  useEffect(() => {
    if (!channel) return;
    const handler = ({ text }: any) => {
      try {
        const data = JSON.parse(text);
        if (data?.type === 'CHAT' && data?.payload?.text) {
          // Ignore our own RTM echo; we add our message locally after persistence
          if (String(data.payload.userFid || '') === String(user?.fid || '')) return;
          const msg: RedisChatMessage = {
            id: `rtm_${Date.now()}_${Math.random()}`,
            roomId,
            userId: String(data.payload.userFid || ''),
            username: String(data.payload.username || ''),
            displayName: String(data.payload.displayName || data.payload.username || 'Anonymous'),
            pfp_url: String(data.payload.pfp_url || ''),
            message: data.payload.text,
            timestamp: new Date(data.ts || Date.now()).toISOString()
          } as any;
          setLiveMessages(prev => [...prev, msg]);
        }
      } catch {}
    };
    channel.on('ChannelMessage', handler);
    return () => {
      try { channel.off('ChannelMessage', handler); } catch {}
    };
  }, [channel, roomId, user?.fid]);

  const combinedMessages = [...redisMessages, ...liveMessages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Always render, but control visibility through CSS classes
  // const modalClass = `chat-modal ${isOpen ? 'open' : ''} ${isClosing ? 'closing' : ''}`;

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={setIsChatOpen}
      />
      
      {/* Full-screen modal content */}
      <div className="relative w-full h-full bg-black/95 backdrop-blur-lg text-white overflow-hidden flex flex-col">
        {/* Chat Header */}
        <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-lg border-b border-fireside-orange/30 px-4 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-fireside-orange rounded-full animate-pulse"></div>
              <h2 className="text-xl font-semibold text-white">Room Chat</h2>
            </div>
            <button
              onClick={setIsChatOpen}
              className="text-gray-400 hover:text-white transition-colors p-2"
              aria-label="Close chat"
            >
              <MdClose size={24} />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white text-sm">Loading messages...</div>
            </div>
          ) : combinedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-12 h-12 bg-gray-100/20 rounded-full flex items-center justify-center mb-3">
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-sm text-white mb-1">No messages yet</p>
              <p className="text-xs text-gray-400">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto">
              {combinedMessages.map((msg) => {
                // Compare the message userId with the current user's fid
                const isOwn = msg.userId === user?.fid;
                
                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isOwnMessage={isOwn}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="sticky bottom-0 bg-black/90 backdrop-blur-lg border-t border-fireside-orange/30 px-4 py-4 flex-shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end space-x-3">
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="w-full px-4 py-3 bg-white/10 text-white rounded-2xl border border-white/30 focus:border-fireside-orange focus:ring-2 focus:ring-fireside-orange focus:ring-opacity-20 outline-none resize-none min-h-[48px] text-base"
                  maxLength={500}
                  rows={1}
                  style={{ 
                    transition: 'height 0.2s ease-out',
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                  }}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="w-12 h-12 bg-fireside-orange text-white rounded-full flex items-center justify-center transition-all hover:bg-fireside-orange/80 disabled:bg-gray-500 disabled:opacity-50 flex-shrink-0"
                title="Send message"
              >
                <MdSend size={20} />
              </button>
            </div>
            {message.length > 400 && (
              <div className="text-xs text-gray-400 mt-2 text-right">
                {message.length}/500
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}