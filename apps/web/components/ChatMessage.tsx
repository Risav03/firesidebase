'use client'

import { formatDistanceToNow } from "./utils/timeUtils";
import { ReplyPreview } from "./ReplyPreview";
import { useRef, useState } from "react";

interface ChatMessageProps {
  message: RedisChatMessage;
  isOwnMessage: boolean;
  onSelectForReply?: (message: RedisChatMessage) => void;
  onScrollToMessage?: (messageId: string) => void;
  isSelected?: boolean;
}

export function ChatMessage({ message, isOwnMessage, onSelectForReply, onScrollToMessage, isSelected = false }: ChatMessageProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  const senderName = message.displayName || message.username || 'Anonymous';
  const messageText = message.message;
  const timestamp = new Date(message.timestamp);
  const pfpUrl = message.pfp_url || '';
  
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

  // Long press handlers
  const handleTouchStart = () => {
    setIsLongPressing(true);
    longPressTimerRef.current = setTimeout(() => {
      if (onSelectForReply) {
        onSelectForReply(message);
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
      onSelectForReply(message);
    }
  };

  return (
    <div 
      className={`chat-message p-2 ${isOwnMessage ? 'own-message' : 'other-message'} ${isSelected ? 'bg-white/5 rounded-lg' : ''} ${isLongPressing ? 'opacity-70' : ''}`}
      id={`message-${message.id}`}
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
          {message.replyTo && (
            <ReplyPreview
              replyTo={message.replyTo}
              variant="inline"
              onClick={() => {
                if (onScrollToMessage) {
                  onScrollToMessage(message.replyTo!.messageId);
                }
              }}
            />
          )}
          <p className="text-sm text-left leading-relaxed whitespace-pre-wrap break-words">
            {messageText}
          </p>
          {(
            <div className={`text-xs mt-1 text-white/40 text-right`}>
              {formatDistanceToNow(timestamp)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}