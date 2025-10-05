"use client";

import { HMSRoomProvider } from "@100mslive/react-sdk";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { base } from "wagmi/chains";
import { ReactNode, useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Rainbow from "./rainbow";
import { GlobalProvider } from "./globalContext";
import { initViewportFix } from "../viewport";

interface ProvidersProps {
  children: ReactNode;
}

import ProgressBar from "@/components/UI/ProgressBar";

export default function Providers({ children }: ProvidersProps) {
  // Initialize viewport fix for mobile
  useEffect(() => {
    const cleanup = initViewportFix();
    return cleanup;
  }, []);

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
