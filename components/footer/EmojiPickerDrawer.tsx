"use client";

import { useEffect, useRef } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";

interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onEmojiSelect: (emoji: { emoji: string }) => void;
  onClose: () => void;
  isDisabled?: boolean;
}

export default function EmojiPickerDrawer({ isOpen, onEmojiSelect, onClose, isDisabled = false }: EmojiPickerDrawerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  
  const emojiPickerStyles = {
    backgroundColor: "#000000",
    "--epr-category-label-bg-color": "#000000",
    borderRadius: "0.5rem",
    width: "100%",
    height: "400px",
    margin: "auto",
    zIndex: 1000
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDisabled) return;
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, isDisabled]);

  return (
    <div
      ref={pickerRef}
      className={`absolute left-0 bottom-[8rem] z-50 w-full mx-auto transition-all flex items-center justify-center duration-200 emoji-picker-container ${
        isOpen ? "" : "opacity-0 pointer-events-none"
      } ${isDisabled ? "pointer-events-none" : ""} rounded-t-xl`}
    >
      {isOpen && (
        <EmojiPicker
          reactionsDefaultOpen={true}
          onReactionClick={onEmojiSelect}
          reactions={['1f525','1f602', '1f4af', '1f44e', '2764-fe0f', '1f44d', '1f622']}
          theme={Theme.DARK}
          onEmojiClick={onEmojiSelect}
          style={emojiPickerStyles}
          autoFocusSearch={false}
        />
      )}
    </div>
  );
}
