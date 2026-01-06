"use client";

/**
 * ChatRTK - RealtimeKit version of Chat
 * 
 * Key changes from 100ms version:
 * - Uses useChat() hook instead of selectHMSMessages + sendBroadcastMessage
 * - Uses meeting.chat.sendTextMessage() for broadcast messages
 * - Uses meeting.chat.on('chatUpdate') for receiving messages
 * - Maintains Redis persistence for message history
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRealtimeKit } from "@/utils/providers/realtimekit";
import { useChat, useLocalParticipant, type ChatMessage as RTKChatMessage } from "@/utils/providers/realtimekit-hooks";
import { ChatMessage } from "./ChatMessage";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import { MdSend } from 'react-icons/md';
import { fetchChatMessages, sendChatMessage } from "@/utils/serverActions";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";

interface RedisChatMessage {
  id: string;
  roomId: string;
  userId: string | number;
  username: string;
  displayName: string;
  pfp_url: string;
  message: string;
  timestamp: string;
  type: 'text';
}

interface ChatRTKProps {
  isOpen: boolean;
  setIsChatOpen: () => void;
  roomId: string;
}

export default function ChatRTK({ isOpen, setIsChatOpen, roomId }: ChatRTKProps) {
  const [message, setMessage] = useState("");
  const [redisMessages, setRedisMessages] = useState<RedisChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { meeting } = useRealtimeKit();
  const { messages: rtkMessages, sendBroadcastMessage } = useChat(meeting);
  const localParticipant = useLocalParticipant(meeting);
  const { user } = useGlobalContext();

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, []);

  // Load messages from Redis on mount
  useEffect(() => {
    const loadMessages = async () => {
      if (!roomId) return;

      setLoading(true);
      try {
        const response = await fetchChatMessages(roomId, 50);
        
        if (response.ok && response.data.success) {
          setRedisMessages(response.data.data.messages);
        } else {
          console.error('Failed to load messages:', response.data.error);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        toast.error('Unable to load chat messages');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [roomId]);

  // Auto-scroll to bottom when new messages arrive or chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 300);
    }
  }, [isOpen, rtkMessages, redisMessages, scrollToBottom]);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120;
      const minHeight = 48;
      
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
    if (!message.trim() || !user?.fid) return;

    const messageText = message.trim();
    setMessage("");
    
    // Reset textarea height after clearing message
    setTimeout(() => {
      adjustTextareaHeight();
      scrollToBottom();
    }, 0);

    try {
      // Send to RealtimeKit for real-time broadcast
      // Format: meeting.chat.sendTextMessage(text)
      const messageWithMetadata = JSON.stringify({
        text: messageText,
        userFid: user.fid,
        pfp_url: user.pfp_url || '',
        username: user.username || '',
        displayName: user.displayName || user.username || '',
        type: 'chat'
      });
      
      await sendBroadcastMessage(messageWithMetadata);

      // Get auth token for backend
      const env = process.env.NEXT_PUBLIC_ENV;
      let token = "";
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      // Store in Redis for persistence
      const response = await sendChatMessage(
        roomId,
        {
          message: messageText
        },
        token
      );

      if (response.ok && response.data.success) {
        // Add the new message to our local state
        setRedisMessages(prev => [...prev, response.data.data.message]);
        setTimeout(scrollToBottom, 100);
      } else {
        console.error('Failed to store message:', response.data.error);
        toast.error('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
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
    
    // For RTK messages
    if ('time' in msg && 'message' in msg) {
      try {
        const parsedMessage = JSON.parse(msg.message);
        return typeof parsedMessage === 'object' && 'text' in parsedMessage;
      } catch (e) {
        return typeof msg.message === 'string';
      }
    }
    
    return false;
  };

  // Filter and combine messages
  const validRedisMessages = redisMessages.filter(isValidMessageStructure);
  
  const validRTKMessages = rtkMessages
    .filter(msg => {
      if (!isValidMessageStructure(msg)) return false;
      
      // Extract text for deduplication
      let messageText;
      try {
        const parsedMsg = JSON.parse(msg.message);
        messageText = parsedMsg.text;
      } catch (e) {
        messageText = msg.message;
      }

      // Check if already in Redis
      return !validRedisMessages.some(redisMsg =>
        redisMsg.message === messageText &&
        Math.abs(new Date(redisMsg.timestamp).getTime() - msg.time.getTime()) < 5000
      );
    })
    .map(rtkMsg => {
      // Parse the message to extract metadata
      let messageText = rtkMsg.message;
      let messageFid = '';
      let messagePfpUrl = '';
      let messageUsername = '';
      let messageDisplayName = '';
      
      try {
        const parsedMsg = JSON.parse(rtkMsg.message);
        messageText = parsedMsg.text;
        messageFid = parsedMsg.userFid || '';
        messagePfpUrl = parsedMsg.pfp_url || '';
        messageUsername = parsedMsg.username || '';
        messageDisplayName = parsedMsg.displayName || '';
      } catch (e) {
        messageText = rtkMsg.message;
      }
      
      return {
        id: `rtk_${rtkMsg.id}`,
        roomId: roomId,
        userId: messageFid || user?.fid || rtkMsg.participantId || 'unknown',
        username: rtkMsg.displayName || 'Unknown',
        displayName: rtkMsg.displayName || 'Unknown',
        pfp_url: '',
        message: messageText,
        timestamp: rtkMsg.time.toISOString(),
        type: 'text' as const
      };
    });

  const combinedMessages = [...validRedisMessages, ...validRTKMessages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <Drawer open={isOpen} onOpenChange={setIsChatOpen}>
      <DrawerContent className="gradient-orange-bg backdrop-blur-lg border-fireside-orange/20 text-white">
        <DrawerHeader className="border-b border-fireside-lightWhite">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-fireside-orange rounded-full animate-pulse"></div>
              <DrawerTitle className="text-xl font-semibold text-white">Room Chat</DrawerTitle>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-6 max-h-[90vh]">
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
            <div className="space-y-4 pb-4">
              {combinedMessages.map((msg) => {
                const isOwn = String(msg.userId) === String(user?.fid);
                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isOwnMessage={isOwn}
                  />
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>

        <DrawerFooter className="border-t border-fireside-lightWhite">
          <div className="flex items-start space-x-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full px-4 py-3 bg-white/5 text-white rounded-lg border border-fireside-lightWhite focus:border-fireside-darkWhite focus:ring-2 focus:ring-fireside-orange transition-colors duration-200 outline-none resize-none min-h-[48px] text-base"
              maxLength={500}
              rows={1}
              onFocus={() => setTimeout(scrollToBottom, 300)}
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim()}
              className="w-12 h-12 bg-fireside-orange aspect-square text-white rounded-lg flex items-center justify-center transition-all hover:bg-fireside-orange/80 disabled:bg-fireside-orange disabled:opacity-30"
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
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

