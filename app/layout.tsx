'use client'

import { HMSRoomProvider } from "@100mslive/react-sdk";
import "../styles/globals.css";
import { ReactNode } from "react";

interface RootLayoutProps {
  children: ReactNode;
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
        <HMSRoomProvider>
          {children}
        </HMSRoomProvider>
      </body>
    </html>
  );
}
