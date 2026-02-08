"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { ReplyPreview } from "./ReplyPreview";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { toast } from "react-toastify";
import { MdSend, MdPersonAdd } from 'react-icons/md';
import { useXMTP } from "@/contexts/XMTPContext";
import { useXMTPRoomGroup } from "@/hooks/useXMTPRoomGroup";
import { useXMTPMessages } from "@/hooks/useXMTPMessages";
import type { XMTPMessageWithMetadata } from "@/hooks/useXMTPMessages";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";

interface ChatProps {
  isOpen: boolean;
  setIsChatOpen: () => void;
  roomId: string;
  roomName?: string;
  roomImageUrl?: string;
  isHost?: boolean;
}

export default function Chat({ 
  isOpen, 
  setIsChatOpen, 
  roomId, 
  roomName, 
  roomImageUrl, 
  isHost = false 
}: ChatProps) {
  const [message, setMessage] = useState("");
  const [selectedReplyMessage, setSelectedReplyMessage] = useState<any>(null);
  const [walletToAdd, setWalletToAdd] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useGlobalContext();
  const { client, isInitialized, isInitializing, error: xmtpError } = useXMTP();
  
  // Initialize XMTP group for this room
  const { 
    group, 
    isLoading: isGroupLoading, 
    error: groupError,
    addMember,
  } = useXMTPRoomGroup({
    roomId,
    roomName,
    roomImageUrl,
    isHost,
  });

  // Handle message streaming and sending
  const {
    messages: xmtpMessages,
    isLoading: isMessagesLoading,
    error: messagesError,
    sendMessage: sendXMTPMessage,
  } = useXMTPMessages({
    group,
  });

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive or chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 300);
    }
  }, [isOpen, xmtpMessages, scrollToBottom]);



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
    if (!message.trim() || !user?.fid) return;
    if (!group) {
      toast.error("Chat not ready. Please wait...");
      return;
    }

    const messageText = message.trim();
    
    setMessage(""); // Clear input immediately
    setSelectedReplyMessage(null); // Clear reply selection
    
    // Reset textarea height after clearing message
    setTimeout(() => {
      adjustTextareaHeight();
      scrollToBottom();
    }, 0);

    try {
      // Send message via XMTP
      const success = await sendXMTPMessage(messageText);

      if (success) {
        setTimeout(scrollToBottom, 100);
      } else {
        toast.error('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error sending message. Please try again.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handler for selecting a message to reply to
  const handleSelectForReply = (msg: RedisChatMessage) => {
    // Find the original XMTP message
    const xmtpMsg = xmtpMessages.find(m => m.id === msg.id);
    if (xmtpMsg) {
      setSelectedReplyMessage(xmtpMsg);
    }
    // Focus the textarea after selection
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  // Handler for clearing reply selection
  const handleClearReply = () => {
    setSelectedReplyMessage(null);
  };

  // Handler for adding a member to the group
  const handleAddMember = async () => {
    const trimmedAddress = walletToAdd.trim();
    
    if (!trimmedAddress) {
      toast.error("Please enter a wallet address");
      return;
    }

    // Basic Ethereum address validation
    if (!trimmedAddress.startsWith("0x") || trimmedAddress.length !== 42) {
      toast.error("Invalid Ethereum address format");
      return;
    }

    if (!group) {
      toast.error("Group chat not ready");
      return;
    }

    setIsAddingMember(true);
    try {
      const success = await addMember(trimmedAddress);
      
      if (success) {
        // Send welcome message
        await sendXMTPMessage(`Welcome ${trimmedAddress.slice(0, 6)}...${trimmedAddress.slice(-4)} to the chat!`);
        toast.success("Member added successfully!");
        setWalletToAdd("");
        setShowAddMember(false);
      } else {
        toast.error("Failed to add member. They may not have XMTP enabled.");
      }
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Failed to add member");
    } finally {
      setIsAddingMember(false);
    }
  };

  // Scroll to a specific message
  const handleScrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      // Add temporary highlight effect
      messageElement.classList.add('highlight-flash');
      setTimeout(() => {
        messageElement.classList.remove('highlight-flash');
      }, 2000);
    }
  };

  // Convert XMTP messages to a display format compatible with ChatMessage component
  const displayMessages: RedisChatMessage[] = xmtpMessages.map((msg) => ({
    id: msg.id,
    roomId: roomId,
    userId: msg.senderInboxId, // Using inbox ID as user identifier
    username: msg.senderUsername || msg.senderAddress || "Unknown",
    displayName: msg.senderDisplayName || msg.senderUsername || "Unknown",
    pfp_url: msg.senderPfp || "",
    message: String(msg.content || ""),
    timestamp: msg.sentAt.toISOString(),
    replyTo: undefined, // TODO: Implement reply-to functionality with XMTP custom content types
  }));

  return (
    <Drawer open={isOpen} onOpenChange={setIsChatOpen}>
      <DrawerContent className="gradient-orange-bg backdrop-blur-lg border-fireside-orange/20 text-white ">
        <DrawerHeader className="border-b border-fireside-lightWhite">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-fireside-orange rounded-full animate-pulse"></div>
              <DrawerTitle className="text-xl font-semibold text-white">
                Room Chat {group && <span className="text-xs text-gray-400 ml-2">(XMTP)</span>}
              </DrawerTitle>
            </div>
            {group && isHost && (
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-fireside-orange/20 hover:bg-fireside-orange/30 text-white rounded-lg transition-colors"
              >
                <MdPersonAdd size={16} />
                {showAddMember ? "Cancel" : "Add Member"}
              </button>
            )}
          </div>
          {showAddMember && group && (
            <div className="mt-4 pt-4 border-t border-fireside-lightWhite/50">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={walletToAdd}
                  onChange={(e) => setWalletToAdd(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddMember();
                    }
                  }}
                  placeholder="Enter wallet address (0x...)"
                  className="flex-1 px-3 py-2 bg-white/5 text-white text-sm rounded-lg border border-fireside-lightWhite focus:border-fireside-darkWhite focus:ring-1 focus:ring-fireside-orange transition-colors outline-none"
                  disabled={isAddingMember}
                />
                <button
                  onClick={handleAddMember}
                  disabled={!walletToAdd.trim() || isAddingMember}
                  className="px-4 py-2 bg-fireside-orange hover:bg-fireside-orange/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors font-medium"
                >
                  {isAddingMember ? "Adding..." : "Add"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Add a wallet address to invite them to this chat. They must have XMTP enabled.
              </p>
            </div>
          )}
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-6 max-h-[90vh] ">
          {!isInitialized ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-12 h-12 bg-gray-100/20 rounded-full flex items-center justify-center mb-3 animate-pulse">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <p className="text-sm text-white mb-1">Initializing secure chat...</p>
              <p className="text-xs text-gray-400">Please sign the message in your wallet</p>
            </div>
          ) : xmtpError || groupError || messagesError ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-sm text-red-400 mb-1">Chat Error</p>
              <p className="text-xs text-gray-400">{xmtpError || groupError || messagesError}</p>
            </div>
          ) : !group ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-12 h-12 bg-gray-100/20 rounded-full flex items-center justify-center mb-3 animate-pulse">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-sm text-white mb-1">Setting up chat...</p>
              <p className="text-xs text-gray-400">
                {isHost ? "Creating group chat..." : "Waiting for host to create chat..."}
              </p>
            </div>
          ) : isMessagesLoading && displayMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white text-sm">Loading messages...</div>
            </div>
          ) : displayMessages.length === 0 ? (
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
              {displayMessages.map((msg) => {
                const isOwn = msg.userId === client?.inboxId;
                const isSelected = selectedReplyMessage?.id === msg.id;
                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isOwnMessage={isOwn}
                    onSelectForReply={handleSelectForReply}
                    onScrollToMessage={handleScrollToMessage}
                    isSelected={isSelected}
                  />
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>

        <DrawerFooter className="border-t border-fireside-lightWhite">
          {selectedReplyMessage && (
            <ReplyPreview
              replyTo={{
                messageId: selectedReplyMessage.id,
                message: String(selectedReplyMessage.content || ""),
                username: selectedReplyMessage.senderUsername || selectedReplyMessage.senderAddress || "Unknown",
                pfp_url: selectedReplyMessage.senderPfp || ""
              }}
              variant="input-banner"
              onClear={handleClearReply}
              onClick={() => handleScrollToMessage(selectedReplyMessage.id)}
            />
          )}
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
              disabled={!message.trim() || !group || !isInitialized}
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