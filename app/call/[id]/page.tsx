import CallClient from '@/components/CallClient';
import Room from '@/utils/schemas/Room';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

  // Fetch room details
  const room = await Room.findOne({ roomId: params.id }).populate('host');

  if (!room) {
    throw new Error('Room not found');
  }

  const hostName = room.host.displayName;

  return {
    title: `${room.name}`,
    description: `Hosted by ${hostName}. ${room.description}`,
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://100msfireside-kolt.vercel.app/fireside_banner.png",
        button: {
          title: "Tune in!",
          action: {
            type: "launch_frame",
            name: "Fireside 100ms",
            url: URL,
            splashImageUrl: "https://100msfireside-kolt.vercel.app/fireside-logo.svg",
            splashBackgroundColor: "#000000",
          },
        },
      }),
    },
  };
}

export default function CallPage({ params }: { params: { id: string } }) {
  return <CallClient roomId={params.id} />;
}
