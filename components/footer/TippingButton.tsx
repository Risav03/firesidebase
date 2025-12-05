import { FaMoneyBill } from "react-icons/fa";
import Button from "../UI/Button";

interface TippingButtonProps {
  onClick: () => void;
}

export default function TippingButton({ onClick }: TippingButtonProps) {
  return (
    <Button
      active={false}
      variant="ghost"
      onClick={onClick}
      className="w-12 aspect-square text-xs font-bold gap-1 rounded-full p-2 text-neutral-green bg-neutral-green/10 border-neutral-green/30 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 "
      title="Send a tip"
    >
      <FaMoneyBill className="text-lg" />
    </Button>
  );
}
