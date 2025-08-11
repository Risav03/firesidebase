'use client'

import { HMSRoomProvider } from "@100mslive/react-sdk";
import "../styles/globals.css";
import { ReactNode } from "react";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { base } from "wagmi/chains";
import { Metadata } from "next";

interface RootLayoutProps {
  children: ReactNode;
}

export async function generateMetadata(): Promise<Metadata> {
  const URL = process.env.NEXT_PUBLIC_URL;
  return {
    title: "Fireside 100ms",
    description: "This is Fireside 100ms",
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://100msfireside-kolt.vercel.app/pfp.png",
        button: {
          title: `Tune in!`,
          action: {
            type: "launch_frame",
            name: "Fireside 100ms",
            url: URL,
            splashImageUrl: "https://100msfireside-kolt.vercel.app/pfp.png",
            splashBackgroundColor: "#3b0404",
          },
        },
      }),
    },
  };
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>100ms Quickstart</title>
      </head>
      <body>
        <MiniKitProvider
      apiKey={process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY}
      chain={base}
    >
        <HMSRoomProvider>
          {children}
        </HMSRoomProvider>
        </MiniKitProvider>
      </body>
    </html>
  );
}
