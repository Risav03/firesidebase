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
    backgroundColor: "#361e14",
    "--epr-category-label-bg-color": "#361e14",
    borderRadius: "0.5rem",
    width: "100%",
    height: "500px",
    margin: "auto",
    zIndex: 100000
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDisabled) return;
      const target = event.target as HTMLElement;
      
      // Check if click is inside picker or on the emoji button (including its children)
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        // Check if the clicked element or any of its parents is the emoji button
        const isEmojiButton = target.closest('[title="reactions"]');
        if (!isEmojiButton) {
          onClose();
        }
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
      className={`fixed left-0 right-0 bottom-[8rem] z-[10000] w-full mx-auto transition-all flex items-center justify-center duration-200 emoji-picker-container ${
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
