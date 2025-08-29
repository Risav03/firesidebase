import CallClient from '@/components/CallClient';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const URL = process.env.BACKEND_URL || 'http://localhost:8000';

  const response = await fetch(`${URL}/api/rooms/public/${params.id}`);
  const data = await response.json();

  const hostName = data.room.host.displayName;

  return {
    title: `${data.room.name}`,
    description: `Hosted by ${hostName}. ${data.room.description}`,
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://100msfireside-kolt.vercel.app/fireside_banner.png",
        button: {
          title: "Tune in!",
          action: {
            type: "launch_frame",
            name: "Fireside 100ms",
            url: URL+ '/call/' + params.id,
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
