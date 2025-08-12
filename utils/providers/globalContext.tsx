"use client";

import { useMiniKit } from "@coinbase/onchainkit/minikit";
import sdk from "@farcaster/miniapp-sdk";
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

interface GlobalContextProps {
  user: any;
  setUser: (value: any) => void;
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const { setFrameReady, isFrameReady } = useMiniKit();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const sessionUser = sessionStorage.getItem("user");

      if (!sessionUser) {
        const res = await sdk.quickAuth.fetch(`/api/me`);
        if (res.ok) {
          setUser((await res.json()).user);
          sessionStorage.setItem(
            "user",
            JSON.stringify((await res.json()).user)
          );

          await sdk.quickAuth.fetch("/api/protected/handleUser", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            }
          });

        }
      } else {
        setUser(JSON.parse(sessionUser));
      }
      
        sdk.actions.ready();
      
    })();
  }, []);

  return (
    <GlobalContext.Provider value={{ user, setUser }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalContext() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobalContext must be used within a GlobalProvider");
  }
  return context;
}
