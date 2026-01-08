import CallClient from '@/components/CallClient';
import { fetchAPI } from '@/utils/serverActions';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const response = await fetchAPI(`${URL}/api/rooms/public/${params.id}`);

  const data = response.data;

  console.log("Room metadata response:", data);

  const hostName = data.data.room?.host?.displayName;

  console.log("Host name:", hostName);

  return {
    title: `${data.data.room.name}`,
    description: `Hosted by ${hostName}. ${data.data.room.description}`,
    
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://firesidebase.vercel.app/fireside_banner.png",
        button: {
          title: "Tune in!",
          action: {
            type: "launch_frame",
            name: "Fireside",
            url: process.env.NEXT_PUBLIC_URL+ '/call/' + params.id,
            splashImageUrl: "https://firesidebase.vercel.app/fireside-logo.svg",
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
