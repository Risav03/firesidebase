import { FaMoneyBill } from "react-icons/fa";

interface TippingButtonProps {
  onClick: () => void;
}

export default function TippingButton({ onClick }: TippingButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:bg-white/20"
      title="Send a tip"
    >
      <FaMoneyBill className="w-5 h-5" />
    </button>
  );
}
