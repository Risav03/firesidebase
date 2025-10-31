"use client";

import { createContext, useContext } from "react";

const ReadyContext = createContext<boolean>(false);

export function AgoraReadyProvider({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return <ReadyContext.Provider value={ready}>{children}</ReadyContext.Provider>;
}

export function useAgoraReady() {
  return useContext(ReadyContext);
}



