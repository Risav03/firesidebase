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
      className="relative w-12 aspect-square rounded-lg p-0 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:bg-white/20"
      title="Send a tip"
    >
      <FaMoneyBill className="w-5 h-5" />
    </Button>
  );
}
