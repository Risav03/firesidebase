"use client";

import Button from "../UI/Button";
import { HiSpeakerWave } from "react-icons/hi2";

interface SoundboardButtonProps {
  onClick: () => void;
  isPlaying?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * SoundboardButton - Button to open the soundboard drawer
 * 
 * Styled to match other footer buttons (emoji, hand raise, etc.)
 */
export default function SoundboardButton({
  onClick,
  isPlaying = false,
  disabled = false,
  className = "",
}: SoundboardButtonProps) {
  return (
    <Button
      variant="ghost"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) {
          onClick();
        }
      }}
      active={isPlaying}
      disabled={disabled}
      className={`w-12 aspect-square text-xs gap-1 font-bold p-2 border-0 overflow-visible rounded-full bg-neutral-blue/5 text-neutral-blue border-neutral-blue/30 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 hover:white/20 cursor-pointer select-none focus:bg-neutral-blue/5 focus:text-neutral-blue active:bg-neutral-blue/5 active:text-neutral-blue ${
        isPlaying ? "animate-pulse bg-fireside-orange/20 text-fireside-orange" : ""
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      title="Soundboard"
      role="button"
    >
      <HiSpeakerWave className={`text-2xl ${isPlaying ? "text-fireside-orange" : ""}`} />
    </Button>
  );
}

