'use client'

import { MdClose, MdReply } from 'react-icons/md';

interface ReplyPreviewProps {
  replyTo: {
    messageId: string;
    message: string;
    username: string;
    pfp_url: string;
  };
  onClear?: () => void;
  onClick?: () => void;
  variant?: 'input-banner' | 'inline';
}

export function ReplyPreview({ replyTo, onClear, onClick, variant = 'inline' }: ReplyPreviewProps) {
  const truncatedMessage = replyTo.message.length > 50 
    ? `${replyTo.message.substring(0, 50)}...` 
    : replyTo.message;

  if (variant === 'input-banner') {
    return (
      <div className="px-4 py-2 bg-white/5 border-l-2 border-fireside-orange flex items-center justify-between">
        <div 
          className="flex items-center space-x-2 flex-1 cursor-pointer"
          onClick={onClick}
        >
          <MdReply className="text-fireside-orange flex-shrink-0" size={16} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-fireside-orange font-medium">
              Replying to {replyTo.username}
            </p>
            <p className="text-xs text-white/60 truncate">
              {truncatedMessage}
            </p>
          </div>
        </div>
        {onClear && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Clear reply"
          >
            <MdClose size={18} className="text-white/60" />
          </button>
        )}
      </div>
    );
  }

  // Inline variant - shown above message bubble
  return (
    <div 
      className="mb-1 pl-3 border-l-2 border-fireside-orange/40 cursor-pointer hover:border-fireside-orange/60 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center space-x-1 mb-0.5">
        <MdReply className="text-fireside-orange/60" size={12} />
        <p className="text-xs text-fireside-orange/80 font-medium">
          {replyTo.username}
        </p>
      </div>
      <p className="text-xs text-white/50 line-clamp-2">
        {truncatedMessage}
      </p>
    </div>
  );
}
