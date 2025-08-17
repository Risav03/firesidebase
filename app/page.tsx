'use server'
import Explore from '@/components/Explore';
import NavigationWrapper from '@/components/NavigationWrapper';
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  return {
    title: "Fireside 100ms",
    description: "This is Fireside 100ms - Drop-in audio chat with interesting people",
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://100msfireside-kolt.vercel.app/fireside_banner.png",
        button: {
          title: `Tune in!`,
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

export default async function Home() {
  return (
    <>
      <Explore />
      <NavigationWrapper />
    </>
  );
}
