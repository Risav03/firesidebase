'use client'

import JoinForm from "../components/JoinForm";
import Conference from "../components/Conference";
import { useEffect, useState } from "react";
import {
  HMSRoomState,
  selectIsConnectedToRoom,
  selectRoomState,
  useHMSActions,
  useHMSStore,
} from "@100mslive/react-sdk";
import Footer from "../components/Footer";
import { Loader } from "../components/Loader";
import Header from "../components/Header";

const loadingStates = [HMSRoomState.Connecting, HMSRoomState.Disconnecting];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const roomState = useHMSStore(selectRoomState);
  const hmsActions = useHMSActions();

  useEffect(() => {
    setMounted(true);
    
    const handleUnload = () => {
      if (isConnected) {
        hmsActions.leave();
      }
    };

    window.onunload = handleUnload;
    
    return () => {
      window.onunload = null;
    };
  }, [hmsActions, isConnected]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <Loader />;
  }

  if (loadingStates.includes(roomState) || !roomState) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-clubhouse-beige to-amber-50">
      {isConnected ? (
        <>
          <Header />
          <Conference />
          <Footer />
        </>
      ) : (
        <JoinForm />
      )}
    </div>
  );
}
