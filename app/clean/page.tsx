"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import JoinForm from "@/components/clean/JoinForm";
import Header from "@/components/clean/Header";
import "@/styles/clean.css";

// Dynamically import Conference with SSR disabled since it uses browser-only Agora SDK
const Conference = dynamic(() => import("@/components/clean/Conference"), {
  ssr: false,
});

export default function CleanPage() {
  const [joined, setJoined] = useState(false);
  const [credentials, setCredentials] = useState({
    appId: "",
    channelName: "",
    token: "",
    uid: ""
  });

  const handleJoin = (appId: string, channelName: string, token: string, uid: string) => {
    setCredentials({ appId, channelName, token, uid });
    setJoined(true);
  };

  const handleLeave = () => {
    setJoined(false);
    setCredentials({ appId: "", channelName: "", token: "", uid: "" });
  };

  return (
    <div className="clean-app">
      <Header />
      {joined ? (
        <Conference
          appId={credentials.appId}
          channelName={credentials.channelName}
          token={credentials.token}
          uid={credentials.uid}
          onLeave={handleLeave}
        />
      ) : (
        <JoinForm onJoin={handleJoin} />
      )}
    </div>
  );
}
