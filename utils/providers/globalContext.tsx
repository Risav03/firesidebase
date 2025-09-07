"use client";

import { useMiniKit } from "@coinbase/onchainkit/minikit";
import sdk from "@farcaster/miniapp-sdk";
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";

interface GlobalContextProps {
  user: any;
  setUser: (value: any) => void;
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const miniKit = useMiniKit();
  
  const handleSignIn = useCallback(async (): Promise<void> => {
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      console.log("Environment:", env);
      
      if (env !== "DEV") {
        // Get the FID from the Farcaster context
        const fid = miniKit.context?.user?.fid;
        console.log("User FID from context:", fid);
        
        if (!fid) {
          console.error("Failed to get FID from user context");
          return;
        }
        
        // Use the FID as a query parameter instead of a token
        const userRes = await fetch(
          `${process.env.NEXT_PUBLIC_URL}/api/protected/handleUser`,
          {
            method: "POST",
            headers:{
              "x-user-fid": fid.toString(),
            }
          }
        );

        if (!userRes.ok) {
          console.error("Failed to create user:", await userRes.text());
          return;
        }
        
        setUser((await userRes.json()).user);
      } else {
        // For development environment
        const devFid = process.env.NEXT_PUBLIC_DEV_FID || "1"; // Default dev FID
        
        const userRes = await fetch(
          `${process.env.NEXT_PUBLIC_URL}/api/protected/handleUser?fid=${devFid}`,
          {
            method: "POST",
          }
        );

        if (!userRes.ok) {
          console.error("Failed to create user:", await userRes.text());
          return;
        }
        
        setUser((await userRes.json()).user);
      }
    } catch (error) {
      console.error("Sign in error:", error);
    }
  }, [miniKit.context?.user?.fid]);

  const hasRunRef = React.useRef(false);
  useEffect(() => {
    (async () => {
      if (hasRunRef.current) return;
      hasRunRef.current = true;
      
      await handleSignIn();
      
      if (process.env.NEXT_PUBLIC_ENV !== "DEV") {
        // Let the app know we're ready
        sdk.actions.ready();
      }
    })();
  }, [handleSignIn]);

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
