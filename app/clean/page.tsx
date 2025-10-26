"use client";

import { useEffect } from "react";
import { useHMSActions, useHMSStore, selectIsConnectedToRoom } from "@100mslive/react-sdk";
import JoinForm from "@/components/clean/JoinForm";
import Conference from "@/components/clean/Conference";
import Footer from "@/components/clean/Footer";
import Header from "@/components/clean/Header";
import "@/styles/clean.css";

export default function CleanPage() {
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const hmsActions = useHMSActions();

  useEffect(() => {
    window.onunload = () => {
      if (isConnected) {
        hmsActions.leave();
      }
    };
  }, [hmsActions, isConnected]);

  return (
    <div className="clean-app">
      <Header />
      {isConnected ? (
        <>
          <Conference />
          <Footer />
        </>
      ) : (
        <JoinForm />
      )}
    </div>
  );
}

