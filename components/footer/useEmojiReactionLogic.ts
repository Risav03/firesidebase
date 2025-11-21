"use client";

import { useState, useEffect } from "react";
import { useHMSActions, useHMSStore, selectLocalPeer, HMSPeer } from "@100mslive/react-sdk";
import { useEmojiReactionEvent } from "@/utils/events";

interface FloatingEmoji {
  emoji: string;
  sender: string;
  id: number;
  position: number;
  fontSize: string;
}

interface EmojiReactionLogicProps {
  user: any;
}

export function useEmojiReactionLogic({ user }: EmojiReactionLogicProps) {
  const hmsActions = useHMSActions();
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  
  const { sendEmoji } = useEmojiReactionEvent((msg: { emoji: string; sender: string }) => {
    console.log("[HMS Event] Emoji reaction received", {
      emoji: msg.emoji,
      sender: msg.sender,
      timestamp: new Date().toISOString(),
    });
    
    const uniqueMsg = {
      ...msg,
      id: Date.now(),
      position: Math.random() * 30,
      fontSize: (Math.random() * 0.5 + 1).toFixed(1)
    };
    setFloatingEmojis((prev) => [...prev, uniqueMsg]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== uniqueMsg.id));
    }, 5000);
  });

  useEffect(() => {
    hmsActions.ignoreMessageTypes(['EMOJI_REACTION']);
  }, [hmsActions]);

  let emojiTimeout: NodeJS.Timeout | null = null;

  const handleEmojiSelect = (emoji: { emoji: string }) => {
    if (emojiTimeout) return;

    console.log("[HMS Action] Sending emoji reaction", {
      emoji: emoji.emoji,
      sender: user?.pfp_url,
      timestamp: new Date().toISOString(),
    });

    emojiTimeout = setTimeout(() => {
      sendEmoji(emoji.emoji, user?.pfp_url);
      emojiTimeout = null;
    }, 700);
  };

  return {
    floatingEmojis,
    handleEmojiSelect
  };
}
