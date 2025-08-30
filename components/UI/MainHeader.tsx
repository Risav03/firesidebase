import Image from "next/image";
import FiresideLogo from "./firesideLogo";

export default function MainHeader() {
  return (
    <header className="bg-black text-white p-4 flex items-center justify-center">
      <FiresideLogo className="w-32" />
    </header>
  );
}
