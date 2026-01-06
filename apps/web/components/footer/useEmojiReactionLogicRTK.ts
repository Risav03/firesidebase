/**
 * useEmojiReactionLogicRTK - RealtimeKit version of emoji reactions
 * 
 * STUB IMPLEMENTATION - Emoji reactions are pending Phase 6 migration.
 * 
 * Once implemented, this will use:
 * - meeting.chat.sendTextMessage() with JSON payload for broadcast emojis
 * - meeting.chat.on('chatUpdate') to receive emoji events
 * 
 * For now, this provides a no-op implementation so the UI can render.
 */
"use client";

import { useState, useCallback } from "react";

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

export function useEmojiReactionLogicRTK({ user }: EmojiReactionLogicProps) {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [isDisabled, setIsDisabled] = useState(false);

  // Stub implementation - just shows local emoji without broadcasting
  const handleEmojiSelect = useCallback((emoji: { emoji: string }) => {
    if (isDisabled) return;

    // Show local emoji animation (no broadcast yet)
    const uniqueEmoji = {
      emoji: emoji.emoji,
      sender: user?.displayName || 'You',
      id: Date.now(),
      position: Math.random() * 30,
      fontSize: (Math.random() * 0.5 + 1).toFixed(1)
    };
    
    setFloatingEmojis((prev) => [...prev, uniqueEmoji]);
    setIsDisabled(true);

    // Remove after animation
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== uniqueEmoji.id));
    }, 5000);

    // Re-enable after cooldown
    setTimeout(() => {
      setIsDisabled(false);
    }, 1500);
  }, [isDisabled, user]);

  return {
    floatingEmojis,
    handleEmojiSelect,
    isDisabled
  };
}

