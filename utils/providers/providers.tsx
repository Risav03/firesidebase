"use client";

import { RtmProvider } from './rtm';
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { base } from "wagmi/chains";
import { ReactNode, useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Rainbow from "./rainbow";
import { GlobalProvider } from "./globalContext";
import { initViewportFix } from "../viewport";
import { AgoraReadyProvider } from "./agoraReady";
import { RtcClientProvider } from "./rtcCtx";

interface ProvidersProps {
  children: ReactNode;
}

import ProgressBar from "@/components/UI/ProgressBar";

// Removed AgoraRTCProvider usage due to initialization crashes; using plain SDK in components

export default function Providers({ children }: ProvidersProps) {
  // Initialize viewport fix for mobile
  useEffect(() => {
    const cleanup = initViewportFix();
    return cleanup;
  }, []);

  // Disable RTC client creation here; plain SDK is created in CallClient
  const [rtcClient] = useState<any>(null);

  return (
    <>
      <ProgressBar />
      <MiniKitProvider
        apiKey={process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY || ""}
        chain={base}
      >
        <GlobalProvider>
        <Rainbow>
          <RtmProvider>
            <AgoraReadyProvider ready={false}>
              <RtcClientProvider client={rtcClient}>
                {children}
              </RtcClientProvider>
            </AgoraReadyProvider>
          </RtmProvider>
        </Rainbow>
        </GlobalProvider>
      </MiniKitProvider>
      <ToastContainer
        position="top-center"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastStyle={{
          background: '#1f2937',
          color: '#fff',
          border: '1px solid #374151',
        }}
      />
    </>
  );
}
