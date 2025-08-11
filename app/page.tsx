'use client'

import JoinForm from "../components/JoinForm";
import Conference from "../components/Conference";
import { useEffect } from "react";
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
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const roomState = useHMSStore(selectRoomState);
  const hmsActions = useHMSActions();

  useEffect(() => {
    window.onunload = () => {
      if (isConnected) {
        hmsActions.leave();
      }
    };
  }, [hmsActions, isConnected]);

  if (loadingStates.includes(roomState) || !roomState) {
    return <Loader />;
  }

  return (
    <div className="App">
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
