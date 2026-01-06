/**
 * @deprecated PENDING MIGRATION TO REALTIMEKIT (Phase 6)
 * 
 * This file uses 100ms hooks for emoji reactions.
 * 
 * RealtimeKit equivalent:
 * - Use meeting.chat.sendTextMessage() with JSON payload for emoji events
 * - Or use a custom events layer via chat
 * 
 * TODO: Create useEmojiReactionLogicRTK.ts
 */
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
  const [isDisabled, setIsDisabled] = useState(false);
  
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

  const handleEmojiSelect = (emoji: { emoji: string }) => {
    if (isDisabled) return;

    sendEmoji(emoji.emoji, user?.pfp_url);
    setIsDisabled(true);
    
    setTimeout(() => {
      setIsDisabled(false);
    }, 1500);
  };

  return {
    floatingEmojis,
    handleEmojiSelect,
    isDisabled
  };
}
