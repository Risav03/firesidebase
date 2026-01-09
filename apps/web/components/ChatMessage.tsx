'use client'

import { HMSMessage } from "@100mslive/react-sdk";
import { formatDistanceToNow } from "./utils/timeUtils";
import { ReplyPreview } from "./ReplyPreview";
import { useRef, useState } from "react";

interface ChatMessageProps {
  message: HMSMessage | RedisChatMessage;
  isOwnMessage: boolean;
  onSelectForReply?: (message: RedisChatMessage) => void;
  onScrollToMessage?: (messageId: string) => void;
  isSelected?: boolean;
}

export function ChatMessage({ message, isOwnMessage, onSelectForReply, onScrollToMessage, isSelected = false }: ChatMessageProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  const isRedisMessage = 'userId' in message;

  // Get sender name based on message type
  const getSenderName = () => {
    if (isRedisMessage) {
      const redisMsg = message as RedisChatMessage;
      return redisMsg.displayName || 'Anonymous';
    } else {
      const hmsMsg = message as HMSMessage;
      return hmsMsg.senderName || 
             hmsMsg.sender || 
             (hmsMsg as any).senderUserId ||
             'Anonymous';
    }
  };
  
  const senderName = getSenderName();
  
  // Get message text
  const getMessageText = () => {
    if (isRedisMessage) {
      return (message as RedisChatMessage).message;
    } else {
      return (message as HMSMessage).message;
    }
  };
  
  // Get timestamp
  const getTimestamp = () => {
    if (isRedisMessage) {
      return new Date((message as RedisChatMessage).timestamp);
    } else {
      return (message as HMSMessage).time;
    }
  };
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-fireside-blue to-fireside-purple',
      'bg-gradient-to-br from-fireside-orange to-fireside-blue',
      'bg-gradient-to-br from-fireside-orange to-fireside-orange',
      'bg-gradient-to-br from-fireside-purple to-fireside-orange',
      'bg-gradient-to-br from-pink-400 to-purple-500',
      'bg-gradient-to-br from-blue-400 to-indigo-500',
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Get profile picture URL
  const getPfpUrl = () => {
    if (isRedisMessage) {
      return (message as RedisChatMessage).pfp_url || '';
    } else {
      // For HMS messages, try to extract pfp_url from parsed metadata
      const hmsMsg = message as HMSMessage;
      try {
        const parsedMsg = JSON.parse(hmsMsg.message);
        return parsedMsg.pfp_url || '';
      } catch (e) {
        return '';
      }
    }
  };

  const pfpUrl = getPfpUrl();

  // Convert HMS message to RedisChatMessage format for selection
  const convertToRedisFormat = (): RedisChatMessage => {
    if (isRedisMessage) {
      return message as RedisChatMessage;
    }
    
    const hmsMsg = message as HMSMessage;
    let messageText = hmsMsg.message;
    let messageFid = '';
    let messagePfpUrl = '';
    let messageUsername = '';
    let messageDisplayName = '';
    
    try {
      const parsedMsg = JSON.parse(hmsMsg.message);
      messageText = parsedMsg.text;
      messageFid = parsedMsg.userFid || '';
      messagePfpUrl = parsedMsg.pfp_url || '';
      messageUsername = parsedMsg.username || '';
      messageDisplayName = parsedMsg.displayName || '';
    } catch (e) {
      messageText = hmsMsg.message;
    }
    
    return {
      id: `hms_${hmsMsg.id}`,
      roomId: '',
      userId: messageFid,
      username: messageUsername || hmsMsg.senderName || 'Unknown',
      displayName: messageDisplayName || hmsMsg.senderName || 'Unknown',
      pfp_url: messagePfpUrl,
      message: messageText,
      timestamp: hmsMsg.time.toISOString()
    };
  };

  // Long press handlers
  const handleTouchStart = () => {
    setIsLongPressing(true);
    longPressTimerRef.current = setTimeout(() => {
      if (onSelectForReply) {
        onSelectForReply(convertToRedisFormat());
        // Haptic feedback on mobile
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
      setIsLongPressing(false);
    }, 500); // 500ms long press threshold
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressing(false);
  };

  // Desktop click handler for reply selection
  const handleClick = (e: React.MouseEvent) => {
    // Only handle if Ctrl/Cmd key is pressed (desktop pattern)
    if ((e.ctrlKey || e.metaKey) && onSelectForReply) {
      onSelectForReply(convertToRedisFormat());
    }
  };

  // Get replyTo data if it exists
  const getReplyTo = () => {
    if (isRedisMessage) {
      return (message as RedisChatMessage).replyTo;
    }
    return undefined;
  };

  const replyTo = getReplyTo();

  return (
    <div 
      className={`chat-message p-2 ${isOwnMessage ? 'own-message' : 'other-message'} ${isSelected ? 'bg-white/5 rounded-lg' : ''} ${isLongPressing ? 'opacity-70' : ''}`}
      id={`message-${isRedisMessage ? (message as RedisChatMessage).id : `hms_${(message as HMSMessage).id}`}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleClick}
    >
      {!isOwnMessage && (
        <div className="chat-avatar flex-shrink-0">
          {pfpUrl ? (
            <>
              <img 
                src={pfpUrl} 
                alt={senderName}
                className="w-8 h-8 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling;
                  if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                }}
              />
              <div className={`w-8 h-8 rounded-full ${getAvatarColor(senderName)} hidden items-center justify-center text-xs font-semibold text-white`}>
                {getInitials(senderName)}
              </div>
            </>
          ) : (
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(senderName)} flex items-center justify-center text-xs font-semibold text-white`}>
              {getInitials(senderName)}
            </div>
          )}
        </div>
      )}
      
      <div className="chat-message-content">
        {!isOwnMessage && (
          <div className="chat-message-header">
            <span className="font-medium text-fireside-green text-sm">
              {senderName}
            </span>
          </div>
        )}
        
        <div className={`chat-message-bubble ${isOwnMessage ? 'own-bubble' : 'other-bubble'}`}>
          {replyTo && (
            <ReplyPreview
              replyTo={replyTo}
              variant="inline"
              onClick={() => {
                if (onScrollToMessage) {
                  onScrollToMessage(replyTo.messageId);
                }
              }}
            />
          )}
          <p className="text-sm text-left leading-relaxed whitespace-pre-wrap break-words">
            {getMessageText()}
          </p>
          {(
            <div className={`text-xs mt-1 text-white/40 text-right`}>
              {formatDistanceToNow(getTimestamp())}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}