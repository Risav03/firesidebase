"use client";

import { HMSRoomProvider } from "@100mslive/react-sdk";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { base } from "wagmi/chains";
import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import Rainbow from "./rainbow";
import { GlobalProvider } from "./globalContext";

interface ProvidersProps {
  children: ReactNode;
}

import ProgressBar from "@/components/UI/ProgressBar";

export default function Providers({ children }: ProvidersProps) {
  return (
    <>
      <ProgressBar />
      <MiniKitProvider
        apiKey={process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY || ""}
        chain={base}
      >
        <GlobalProvider>
        <Rainbow>
          <HMSRoomProvider>{children}</HMSRoomProvider>
        </Rainbow>
        </GlobalProvider>
      </MiniKitProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid #374151',
          },
          success: {
            style: {
              background: '#059669',
              border: '1px solid #10b981',
            },
          },
          error: {
            style: {
              background: '#dc2626',
              border: '1px solid #ef4444',
            },
          },
        }}
      />
    </>
  );
}
