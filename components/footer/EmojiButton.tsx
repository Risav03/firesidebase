import Button from "../UI/Button";
import { MdEmojiEmotions } from "react-icons/md";


interface EmojiButtonProps {
  onClick: () => void;
  className?: string;
}

export default function EmojiButton({ onClick, className }: EmojiButtonProps) {
  return (
    <Button
      variant="ghost"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={` w-32 text-xs gap-1 font-bold px-4 py-2 overflow-visible rounded-full bg-fireside-blue/10 text-fireside-blue border-fireside-blue/30 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 hover:white/20 cursor-pointer select-none`}
      title="reactions"
      role="button"
    >
      <MdEmojiEmotions className="w-6 h-6" /> Reactions
    </Button>
  );
}
