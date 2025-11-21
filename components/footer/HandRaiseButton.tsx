import { HandRaiseIcon } from "@100mslive/react-icons";

interface HandRaiseButtonProps {
  isHandRaised: boolean;
  handRaiseDisabled: boolean;
  handRaiseCountdown: number;
  onClick: () => void;
}

export default function HandRaiseButton({ 
  isHandRaised, 
  handRaiseDisabled, 
  handRaiseCountdown, 
  onClick 
}: HandRaiseButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform ${
        !handRaiseDisabled ? "hover:scale-105 active:scale-95" : " cursor-not-allowed"
      } ${
        isHandRaised
          ? "bg-fireside-orange text-white shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20"
      }`}
      disabled={handRaiseDisabled && !isHandRaised}
      title={handRaiseDisabled && !isHandRaised ? "Hand raise cooldown (10s)" : isHandRaised ? "Lower hand" : "Raise hand"}
    >
      {!(handRaiseDisabled && !isHandRaised) && (
        <HandRaiseIcon className="w-5 h-5" />
      )}
      
      {handRaiseDisabled && !isHandRaised && (
        <div className="absolute inset-0 rounded-full flex items-center justify-center">
          <svg className="absolute inset-0 w-10 h-10 transform -rotate-90">
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
            />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="rgb(251, 146, 60)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 18}`}
              strokeDashoffset={`${2 * Math.PI * 18 * (handRaiseCountdown / 10)}`}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          
          <span className="text-xs text-white font-semibold z-10">{handRaiseCountdown}</span>
        </div>
      )}
    </button>
  );
}
