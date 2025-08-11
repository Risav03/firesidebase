'use client'

import { HMSMessage } from "@100mslive/react-sdk";
import { formatDistanceToNow } from "./utils/timeUtils";

interface ChatMessageProps {
  message: HMSMessage;
  isOwnMessage: boolean;
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  // Debug: Log the message object to see its structure
  console.log('Message object:', message);
  
  // Try multiple possible ways to get the sender name
  const getSenderName = () => {
    return message.senderName || 
           message.sender?.name || 
           message.sender || 
           (message as any).senderUserId ||
           'Anonymous';
  };
  
  const senderName = getSenderName();
  
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
      'bg-gradient-to-br from-clubhouse-blue to-clubhouse-purple',
      'bg-gradient-to-br from-clubhouse-green to-clubhouse-blue',
      'bg-gradient-to-br from-clubhouse-orange to-clubhouse-green',
      'bg-gradient-to-br from-clubhouse-purple to-clubhouse-orange',
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
      {!isOwnMessage && (
        <div className={`chat-avatar ${getAvatarColor(senderName)}`}>
          {getInitials(senderName)}
        </div>
      )}
      
      <div className="chat-message-content">
        {!isOwnMessage && (
          <div className="chat-message-header">
            <span className="font-medium text-gray-900 text-sm">
              {senderName}
            </span>
            <span className="text-xs text-gray-500 ml-2">
              {formatDistanceToNow(message.time)}
            </span>
          </div>
        )}
        
        <div className={`chat-message-bubble ${isOwnMessage ? 'own-bubble' : 'other-bubble'}`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.message}
          </p>
          {isOwnMessage && (
            <div className="text-xs text-gray-500 mt-1 text-right">
              {formatDistanceToNow(message.time)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
