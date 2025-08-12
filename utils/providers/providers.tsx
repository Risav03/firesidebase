"use client";

import { HMSRoomProvider } from "@100mslive/react-sdk";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { base } from "wagmi/chains";
import { ReactNode } from "react";
import Rainbow from "./rainbow";
import { GlobalProvider } from "./globalContext";

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    
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

  );
}
