"use client";

import { useEffect } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";

interface EmojiPickerDrawerProps {
  isOpen: boolean;
  onEmojiSelect: (emoji: { emoji: string }) => void;
}

export default function EmojiPickerDrawer({ isOpen, onEmojiSelect }: EmojiPickerDrawerProps) {
  const emojiPickerStyles = {
    backgroundColor: "#000000",
    "--epr-category-label-bg-color": "#000000",
    borderRadius: "0.5rem",
    width: "100%",
    height: "400px",
    margin: "auto",
    zIndex: 1000
  };

  return (
    <div
      className={`absolute left-0 bottom-[8.5rem] z-50 w-full mx-auto transition-all flex items-center justify-center duration-200 emoji-picker-container ${
        isOpen ? "" : "opacity-0 pointer-events-none"
      } rounded-t-xl`}
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
