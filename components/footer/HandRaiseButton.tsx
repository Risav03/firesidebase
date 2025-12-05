import { HiOutlineHandRaised } from "react-icons/hi2";
import Button from "../UI/Button";

interface HandRaiseButtonProps {
  isHandRaised: boolean;
  handRaiseDisabled: boolean;
  handRaiseCountdown: number;
  onClick: () => void;
  className?: string;
}

export default function HandRaiseButton({ 
  isHandRaised, 
  handRaiseDisabled, 
  handRaiseCountdown, 
  onClick,
  className
}: HandRaiseButtonProps) {
  const progress = handRaiseDisabled && !isHandRaised ? (handRaiseCountdown / 10) * 100 : 0;
  
  return (
    <div className="relative w-full">
      <Button
      active={false}
        variant="ghost"
        onClick={onClick}
        className={`relative w-12 overflow-hidden aspect-square flex items-center text-xs font-bold border-neutral-orange/30 p-2 rounded-full mx-auto overflow-hidden ${
          !handRaiseDisabled ? "hover:scale-105 active:scale-95" : "cursor-not-allowed"
        } ${
          isHandRaised
            ? "bg-neutral-orange text-white shadow-lg"
            : "text-neutral-orange bg-neutral-orange/10 hover:bg-white/20"
        }`}
        disabled={handRaiseDisabled && !isHandRaised}
        title={handRaiseDisabled && !isHandRaised ? "Hand raise cooldown (10s)" : isHandRaised ? "Lower hand" : "Raise hand"}
      >
        {handRaiseDisabled && !isHandRaised && (
          <div 
            className="absolute bottom-0 left-0 h-screen bg-gray-400/20 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        )}
        <HiOutlineHandRaised className="text-lg mx-auto relative z-10" />
      </Button>
    </div>
  );
}
