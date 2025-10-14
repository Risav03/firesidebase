"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  selectHMSMessages,
  selectLocalPeer,
  useHMSActions,
  useHMSStore,
  HMSMessage,
} from "@100mslive/react-sdk";
import { ChatMessage } from "./ChatMessage";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "./UI/drawer";
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

  const messages = useHMSStore(selectHMSMessages);
  const hmsActions = useHMSActions();
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
          setRedisMessages(response.data.data.messages);
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
  }, [messages, redisMessages, scrollToBottom]);

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
    if (isOpen && !loading && (redisMessages.length > 0 || messages.length > 0)) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [isOpen, loading, redisMessages.length, messages.length, scrollToBottom]);

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
      // Send to HMS for real-time broadcast
      // Format the message to include user fid for identification
      const messageWithMetadata = JSON.stringify({
        text: messageText,
        userFid: user.fid,
        type: 'chat'
      });
      hmsActions.sendBroadcastMessage(messageWithMetadata);

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
        // Add the new message to our local state
        setRedisMessages(prev => [...prev, response.data.data.message]);
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

  // Filter and combine messages
  const validRedisMessages = redisMessages.filter(isValidMessageStructure);
  const validHMSMessages = messages
    .filter(msg => {
      if (!isValidMessageStructure(msg)) return false;
      
      // Check if this message already exists in Redis
      // For HMS messages that contain JSON, we need to extract the text part
      let messageText;
      try {
        const parsedMsg = JSON.parse(msg.message);
        messageText = parsedMsg.text;
      } catch (e) {
        messageText = msg.message;
      }

      return !validRedisMessages.some(redisMsg =>
        redisMsg.message === messageText &&
        Math.abs(new Date(redisMsg.timestamp).getTime() - msg.time.getTime()) < 5000
      );
    })
    .map(hmsMsg => {
      // Try to parse the message as JSON to extract user fid
      let messageText = hmsMsg.message;
      let messageFid = '';
      
      try {
        const parsedMsg = JSON.parse(hmsMsg.message);
        messageText = parsedMsg.text;
        messageFid = parsedMsg.userFid || '';
      } catch (e) {
        // If parsing fails, use the message as is
        messageText = hmsMsg.message;
      }
      
      return {
        id: `hms_${hmsMsg.id}`,
        roomId: roomId,
        userId: messageFid || user.fid || hmsMsg.sender || 'unknown',
        username: hmsMsg.senderName || hmsMsg.sender || 'Unknown',
        displayName: hmsMsg.senderName || hmsMsg.sender || 'Unknown',
        pfp_url: '',
        message: messageText,
        timestamp: hmsMsg.time.toISOString(),
        type: 'text' as const
      };
    });

  const combinedMessages = [...validRedisMessages, ...validHMSMessages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Always render, but control visibility through CSS classes
  // const modalClass = `chat-modal ${isOpen ? 'open' : ''} ${isClosing ? 'closing' : ''}`;

  return (
    <Drawer open={isOpen} onOpenChange={setIsChatOpen} dismissible >
      <DrawerContent 
        className="backdrop-blur-2xl border-fireside-orange/30 border-t-2 border-x-0 border-b-0"
      >
        
        {/* Chat Header */}
        <div className="px-4 py-3 flex border-b border-gray-700/50">
          <div className="flex items-center space-x-3 w-[50%]">
            <div className="w-3 h-3 bg-fireside-orange rounded-full animate-pulse"></div>
            <h3 className="font-semibold text-white">Room Chat</h3>
          </div>
          <div className="flex items-center space-x-2 justify-end w-[50%]">
            {/* <DrawerClose className="p-1 hover:bg-gray-100/20 bg-gray-100/10 rounded-lg transition-colors">
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
            </DrawerClose> */}
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          className="p-4 flex-grow overflow-y-auto transition-all duration-300"
          style={{ height: getMessagesHeight() }}
        >
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-sm text-white mb-1">No messages yet</p>
              <p className="text-xs text-gray-400">Start the conversation!</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
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
              </div>
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-gray-700/50">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <textarea
                onPointerDown={(e) => e.stopPropagation()}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full px-4 py-3 bg-white/10 text-white rounded-2xl border border-white/30 focus:border-fireside-orange focus:ring-2 focus:ring-fireside-orange focus:ring-opacity-20 outline-none resize-none min-h-[48px]"
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
              className="w-10 h-10 bg-fireside-orange text-white rounded-full flex items-center justify-center transition-all hover:bg-fireside-orange/80 disabled:bg-gray-500 disabled:opacity-50"
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
            <div className="text-xs text-gray-400 mt-1 text-right">
              {message.length}/500
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}