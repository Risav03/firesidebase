'use client'

import { HMSRoomProvider } from "@100mslive/react-sdk";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { base } from "wagmi/chains";
import { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <MiniKitProvider
      apiKey={process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY || ''}
      chain={base}
    >
      <HMSRoomProvider>
        {children}
      </HMSRoomProvider>
    </MiniKitProvider>
  );
}
