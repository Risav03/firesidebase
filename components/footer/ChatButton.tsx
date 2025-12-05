import Button from "../UI/Button";
import { IoChatbubbleSharp } from "react-icons/io5";


interface ChatButtonProps {
  isChatOpen: boolean;
  unreadCount: number;
  onClick: () => void;
}

export default function ChatButton({ isChatOpen, unreadCount, onClick }: ChatButtonProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`w-32 rounded-full text-xs px-4 py-2 gap-1 flex items-center border-fireside-yellow/30 justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
        isChatOpen
          ? "bg-fireside-orange text-white shadow-lg"
          : "bg-fireside-yellow/10 text-fireside-yellow hover:bg-fireside-yellow/20"
      }`}
      title="Toggle chat"
    >
      <IoChatbubbleSharp className="w-5 h-5" /> Chat
      {unreadCount > 0 && !isChatOpen && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-fireside-red text-white text-xs rounded-full flex items-center justify-center ">
          {unreadCount > 9 ? "9+" : unreadCount}
        </div>
      )}
    </Button>
  );
}
