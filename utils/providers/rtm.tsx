"use client";

import { createContext, useContext, useEffect, useState } from "react";

type RtmContextValue = { client: any | null; channel: any; setChannel: (ch: any) => void };

export const RtmContext = createContext<RtmContextValue>({ client: null, channel: null, setChannel: () => {} });

export function useRtmClient() { return useContext(RtmContext); }

export function RtmProvider({ children }: { children: React.ReactNode }) {
  const [channel, setChannel] = useState<any>(null);
  const [rtmClient, setRtmClient] = useState<any>(null);
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        if (!appId) return;
        if (typeof window === 'undefined') return;
        const { default: AgoraRTM } = await import("agora-rtm-sdk");
        const client = AgoraRTM.createInstance(appId);
        if (isMounted) setRtmClient(client);
      } catch {}
    }
    init();
    return () => { isMounted = false; };
  }, [appId]);

  return <RtmContext.Provider value={{ client: rtmClient, channel, setChannel }}>{children}</RtmContext.Provider>;
}


