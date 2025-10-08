'use server'
import LiveRoomList from '@/components/LiveRoomList';
import NavigationWrapper from '@/components/NavigationWrapper';
import MainHeader from '@/components/UI/MainHeader';
import { Metadata } from 'next';

export interface Room {
  _id: string;
  name: string;
  description: string;
  host: {
    fid: string;
    username: string;
    displayName: string;
    pfp_url: string;
  };
  status: string;
  startTime: string;
  strength: number;
  sponsorshipEnabled: boolean;
  topics: string[];
}

export async function generateMetadata(): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  return {
    title: "Fireside 100ms",
    description: "This is Fireside 100ms - Drop-in audio chat with interesting people",
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://firesidebase.vercel.app/fireside_banner.png",
        button: {
          title: `Tune in!`,
          action: {
            type: "launch_frame",
            name: "Fireside 100ms",
            url: URL,
            splashImageUrl: "https://firesidebase.vercel.app/app-icon.png",
            splashBackgroundColor: "#000000",
          },
        },
      }),
    },
  };
}

export default async function Home() {
  return (
    <>
      <MainHeader/>
      <LiveRoomList />
      <NavigationWrapper />
    </>
  );
}