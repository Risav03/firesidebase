import Button from "../UI/Button";

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
      className={`relative h-12 aspect-square p-2 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
        isChatOpen
          ? "bg-fireside-orange text-white shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20"
      }`}
      title="Toggle chat"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      {unreadCount > 0 && !isChatOpen && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-fireside-red text-white text-xs rounded-full flex items-center justify-center ">
          {unreadCount > 9 ? "9+" : unreadCount}
        </div>
      )}
    </Button>
  );
}
