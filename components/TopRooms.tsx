"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FaHeadphones } from "react-icons/fa";

export default function TopRooms({ rooms }: { rooms?: any[] }) {
  const router = useRouter();

  if(rooms && rooms?.length > 0)
  return (
    <div className=" bg-black w-screen overflow-x-scroll hide-scrollbar p-2 border-y border-white/5">
      <div className="flex gap-2 w-max">
        {rooms?.slice(0, 5).map((room) => (
          <div
            onClick={() => router.push(`/call/${room._id}`)}
            key={room._id}
            className="flex items-center gap-2 w-72 truncate text-white p-1 font-bold gradient-fire pr-3 rounded-full text-nowrap"
          >
            <div className="relative">
              <Image
                src={`${process.env.NEXT_PUBLIC_URL}/waves.gif`}
                width={1920}
                height={1080}
                alt="Fireside Logo"
                className="w-8 aspect-square rounded-full absolute left-0 top-0 p-[0.3rem] brightness-0 invert grayscale opacity-70"
              />
              <Image
                width={1080}
                height={1080}
                src={room.host.pfp_url}
                alt={room.host.displayName}
                className="w-8 aspect-square rounded-full border-2 border-white"
              />
            </div>
            <div className="flex justify-between w-full items-center">
              <span>{room.name.slice(0,20)}{room.name.length > 20 ? '...' : ''} </span>
              <span className=" text-white flex gap-1 items-center justify-center">{room.strength} <FaHeadphones/></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
