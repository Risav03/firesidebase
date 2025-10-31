'use client'

import { formatDistanceToNow } from "./utils/timeUtils";

interface ChatMessageProps {
  message: RedisChatMessage;
  isOwnMessage: boolean;
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  
  const isRedisMessage = true;

  // Get sender name based on message type
  const getSenderName = () => {
    if (isRedisMessage) {
      const redisMsg = message as RedisChatMessage;
      return redisMsg.displayName || 'Anonymous';
    }
  };
  
  const senderName = getSenderName();
  
  // Get message text
  const getMessageText = () => {
    if (isRedisMessage) {
      return (message as RedisChatMessage).message;
    }
  };
  
  // Get timestamp
  const getTimestamp = () => {
    if (isRedisMessage) {
      return new Date((message as RedisChatMessage).timestamp);
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

  return (
    <div className={`chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`}>
      {/* {!isOwnMessage && (
        <div className={`chat-avatar ${getAvatarColor(senderName)}`}>
          {getInitials(senderName)}
        </div>
      )} */}
      
      <div className="chat-message-content">
        {!isOwnMessage && (
          <div className="chat-message-header">
            <span className="font-medium text-fireside-orange text-sm">
              {senderName}
            </span>
          </div>
        )}
        
        <div className={`chat-message-bubble ${isOwnMessage ? 'own-bubble' : 'other-bubble'}`}>
          <p className="text-sm text-left leading-relaxed whitespace-pre-wrap break-words">
            {getMessageText()}
          </p>
          {(
            <div className={`text-xs mt-1 text-white/40 text-right`}>
              {formatDistanceToNow(getTimestamp() || new Date())}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}