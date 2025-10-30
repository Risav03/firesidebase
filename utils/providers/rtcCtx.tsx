"use client";

import { createContext, useContext } from "react";

type RtcContextValue = { client: any | null };

const Ctx = createContext<RtcContextValue>({ client: null });

export function RtcClientProvider({ client, children }: { client: any | null; children: React.ReactNode }) {
  return <Ctx.Provider value={{ client }}>{children}</Ctx.Provider>;
}

export function useRtcClientCtx() {
  return useContext(Ctx);
}



