import { FaMoneyBill } from "react-icons/fa";
import Button from "../UI/Button";

interface TippingButtonProps {
  onClick: () => void;
}

export default function TippingButton({ onClick }: TippingButtonProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="w-32 text-xs font-bold gap-1 rounded-full p-0 px-4 py-2 text-fireside-green bg-fireside-green/10 border-fireside-green/30 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 "
      title="Send a tip"
    >
      <FaMoneyBill className="w-5 h-5" /> Tip Room
    </Button>
  );
}
