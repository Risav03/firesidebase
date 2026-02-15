"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  selectHMSMessages,
  selectLocalPeer,
  selectPeers,
  useHMSActions,
  useHMSStore,
  HMSMessage,
  HMSPeer,
} from "@100mslive/react-sdk";
import { ChatMessage } from "./ChatMessage";
import { ReplyPreview } from "./ReplyPreview";
import { MentionPopup } from "./MentionPopup";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import { MdClose, MdSend } from 'react-icons/md';
import { fetchChatMessages, sendChatMessage } from "@/utils/serverActions";
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
}

export default function Chat({ isOpen, setIsChatOpen, roomId }: ChatProps) {
  const [message, setMessage] = useState("");
  const [redisMessages, setRedisMessages] = useState<RedisChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReplyMessage, setSelectedReplyMessage] = useState<RedisChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention popup state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const messages = useHMSStore(selectHMSMessages);
  const peers = useHMSStore(selectPeers);
  const hmsActions = useHMSActions();
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
  }, [isOpen, messages, redisMessages, scrollToBottom]);



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
    const replyToId = selectedReplyMessage?.id;
    
    setMessage(""); // Clear input immediately
    setSelectedReplyMessage(null); // Clear reply selection
    
    // Reset textarea height after clearing message
    setTimeout(() => {
      adjustTextareaHeight();
      scrollToBottom();
    }, 0);

    try {
      // Send to HMS for real-time broadcast
      // Format the message to include user fid and reply metadata for identification
      const messageWithMetadata = JSON.stringify({
        text: messageText,
        userFid: user.fid,
        pfp_url: user.pfp_url || '',
        username: user.username || '',
        displayName: user.displayName || user.username || '',
        type: 'chat',
        replyTo: selectedReplyMessage ? {
          messageId: selectedReplyMessage.id,
          message: selectedReplyMessage.message.substring(0, 100),
          username: selectedReplyMessage.username,
          pfp_url: selectedReplyMessage.pfp_url
        } : undefined
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
          replyToId: replyToId
        },
        token
      );

      if (response.ok && response.data.success) {
        const responseData = response.data.data;
        
        // Check if response includes bot message (Bankr AI trigger)
        if (responseData.userMessage && responseData.botMessage) {
          // Add user message to local state
          setRedisMessages(prev => [...prev, responseData.userMessage]);
          
          // Add bot message to local state (no HMS broadcast needed - Redis is source of truth)
          setRedisMessages(prev => [...prev, responseData.botMessage]);
          
          // Start polling for bot message completion
          pollForBotMessageUpdate(responseData.botMessage.id);
        } else {
          // Regular message (no bot trigger)
          setRedisMessages(prev => [...prev, responseData.message || responseData]);
        }
        
        setTimeout(scrollToBottom, 100);
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

  // Poll for bot message updates (when AI response is ready)
  const pollForBotMessageUpdate = async (botMessageId: string, maxAttempts = 30, interval = 2000) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, interval));
      
      // Refresh messages from Redis
      try {
        const response = await fetchChatMessages(roomId, 50);
        if (response.ok && response.data.success) {
          const messages = response.data.data.messages;
          const updatedBotMessage = messages.find((m: RedisChatMessage) => m.id === botMessageId);
          
          if (updatedBotMessage && updatedBotMessage.status !== 'pending') {
            // Bot message has been updated, update local state by replacing the pending message
            setRedisMessages(prev => 
              prev.map(msg => msg.id === botMessageId ? updatedBotMessage : msg)
            );
            
            // Broadcast bot message via HMS so all users see it in real-time
            const botMessageWithMetadata = JSON.stringify({
              text: updatedBotMessage.message,
              userFid: updatedBotMessage.userId,
              pfp_url: updatedBotMessage.pfp_url || '/assets/bankr.png',
              username: updatedBotMessage.username || 'Bankr',
              displayName: updatedBotMessage.displayName || 'Bankr',
              type: 'chat',
              isBot: true,
              status: updatedBotMessage.status,
              transactions: updatedBotMessage.transactions,
              prompterFid: updatedBotMessage.prompterFid,
              replyTo: updatedBotMessage.replyTo
            });
            hmsActions.sendBroadcastMessage(botMessageWithMetadata);
            
            setTimeout(scrollToBottom, 100);
            break;
          }
        }
      } catch (error) {
        console.error('Error polling for bot message:', error);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Don't submit if mention popup is open (let it handle navigation)
    if (showMentionPopup && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      return; // MentionPopup handles these keys
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle message input change with mention detection
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setMessage(value);

    // Detect @ mentions
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      const query = atMatch[1];
      const startIndex = cursorPos - query.length - 1; // -1 for @
      setMentionQuery(query);
      setMentionStartIndex(startIndex);
      setShowMentionPopup(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentionPopup(false);
      setMentionQuery("");
    }
  };

  // Handle mention selection
  const handleMentionSelect = (peer: HMSPeer | null, displayText: string) => {
    const beforeMention = message.substring(0, mentionStartIndex);
    const afterMention = message.substring(mentionStartIndex + mentionQuery.length + 1); // +1 for @
    const newMessage = `${beforeMention}@${displayText} ${afterMention}`;
    
    setMessage(newMessage);
    setShowMentionPopup(false);
    setMentionQuery("");
    
    // Focus back on textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = mentionStartIndex + displayText.length + 2; // @ + name + space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Close mention popup
  const handleMentionClose = () => {
    setShowMentionPopup(false);
    setMentionQuery("");
  };

  // Handler for selecting a message to reply to
  const handleSelectForReply = (msg: RedisChatMessage) => {
    setSelectedReplyMessage(msg);
    // Focus the textarea after selection
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  // Handler for clearing reply selection
  const handleClearReply = () => {
    setSelectedReplyMessage(null);
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
      let isBot = false;
      try {
        const parsedMsg = JSON.parse(msg.message);
        messageText = parsedMsg.text;
        isBot = parsedMsg.isBot === true;
      } catch (e) {
        messageText = msg.message;
      }

      // For bot messages, check if already in Redis to avoid duplicates
      // Bot messages are broadcast via HMS for real-time visibility to all users
      return !validRedisMessages.some(redisMsg =>
        redisMsg.message === messageText &&
        Math.abs(new Date(redisMsg.timestamp).getTime() - msg.time.getTime()) < 5000
      );
    })
    .map(hmsMsg => {
      // Try to parse the message as JSON to extract user fid
      let messageText = hmsMsg.message;
      let messageFid = '';
      let messagePfpUrl = '';
      let messageUsername = '';
      let messageDisplayName = '';
      let messageReplyTo = undefined;
      let messageIsBot = false;
      let messageStatus: 'pending' | 'completed' | 'failed' | undefined = undefined;
      let messageTransactions = undefined;
      let messagePrompterFid = undefined;
      
      try {
        const parsedMsg = JSON.parse(hmsMsg.message);
        messageText = parsedMsg.text;
        messageFid = parsedMsg.userFid || '';
        messagePfpUrl = parsedMsg.pfp_url || '';
        messageUsername = parsedMsg.username || '';
        messageDisplayName = parsedMsg.displayName || '';
        messageReplyTo = parsedMsg.replyTo;
        messageIsBot = parsedMsg.isBot || false;
        messageStatus = parsedMsg.status;
        messageTransactions = parsedMsg.transactions;
        messagePrompterFid = parsedMsg.prompterFid;
      } catch (e) {
        // If parsing fails, use the message as is
        messageText = hmsMsg.message;
      }
      
      return {
        id: `hms_${hmsMsg.id}`,
        roomId: roomId,
        userId: messageFid || user.fid || hmsMsg.sender || 'unknown',
        username: messageUsername || hmsMsg.senderName || hmsMsg.sender || 'Unknown',
        displayName: messageDisplayName || hmsMsg.senderName || hmsMsg.sender || 'Unknown',
        pfp_url: messagePfpUrl,
        message: messageText,
        timestamp: hmsMsg.time.toISOString(),
        type: 'text' as const,
        replyTo: messageReplyTo,
        isBot: messageIsBot,
        status: messageStatus,
        transactions: messageTransactions,
        prompterFid: messagePrompterFid
      };
    });

  const combinedMessages = [...validRedisMessages, ...validHMSMessages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Always render, but control visibility through CSS classes
  // const modalClass = `chat-modal ${isOpen ? 'open' : ''} ${isClosing ? 'closing' : ''}`;

  return (
    <Drawer open={isOpen} onOpenChange={setIsChatOpen}>
      <DrawerContent className="gradient-orange-bg backdrop-blur-lg border-fireside-orange/20 text-white ">
        <DrawerHeader className="border-b border-fireside-lightWhite">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-fireside-orange rounded-full animate-pulse"></div>
              <DrawerTitle className="text-xl font-semibold text-white">Room Chat</DrawerTitle>
            </div>
          </div>
          <p className="text-xs text-white/50 mt-2">
            💡 Type <span className="text-fireside-orange font-mono">/bankr</span> followed by a question to ask Bankr AI. Reply to Bankr to continue the conversation.
          </p>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-6 max-h-[90vh] ">
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
                const isSelected = selectedReplyMessage?.id === msg.id;
                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isOwnMessage={isOwn}
                    onSelectForReply={handleSelectForReply}
                    onScrollToMessage={handleScrollToMessage}
                    isSelected={isSelected}
                    currentUserFid={user?.fid?.toString()}
                    roomId={roomId}
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
                message: selectedReplyMessage.message,
                username: selectedReplyMessage.username,
                pfp_url: selectedReplyMessage.pfp_url
              }}
              variant="input-banner"
              onClear={handleClearReply}
              onClick={() => handleScrollToMessage(selectedReplyMessage.id)}
            />
          )}
          <div className="relative flex items-start space-x-3">
            {/* Mention Popup */}
            {showMentionPopup && (
              <MentionPopup
                peers={peers}
                query={mentionQuery}
                onSelect={handleMentionSelect}
                onClose={handleMentionClose}
                selectedIndex={selectedMentionIndex}
                onSelectedIndexChange={setSelectedMentionIndex}
              />
            )}
            
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleMessageChange}
                onKeyDown={(e) => {
                  // Prevent default for keys handled by mention popup
                  if (showMentionPopup && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onKeyPress={handleKeyPress}
                placeholder="Type a message... Use @ to mention"
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