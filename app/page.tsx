'use server'
import Explore from '@/components/Explore';
import NavigationWrapper from '@/components/NavigationWrapper';
import NotificationDrawer from '@/components/NotificationDrawer';
import TopRooms from '@/components/TopRooms';
import MainHeader from '@/components/UI/MainHeader';
import { Metadata } from 'next';
import { Suspense } from 'react';

interface Room {
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

// Server-side function to fetch rooms
async function fetchRooms(): Promise<Room[]> {
  try {
    const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${URL}/api/rooms/public`, {
      cache: 'no-store'
    });
    const data = await response.json();
    
    if (data.success) {
      return data.data.rooms;
    }
    return [];
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return [];
  }
}

export default async function Home() {
  const rooms = await fetchRooms();
  
  return (
    <>
      <MainHeader/>
      <TopRooms rooms={rooms}/>
      <Explore rooms={rooms} />
      <NavigationWrapper />
      {/* <NotificationDrawer /> */}
    </>
  );
}
