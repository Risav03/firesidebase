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
import { generateNonce } from "@farcaster/auth-client";

interface GlobalContextProps {
  user: any;
  setUser: (value: any) => void;
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {

  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    (async () => {
      // const sessionUser = sessionStorage.getItem("user");

      // if (!sessionUser) {
      //   await handleSignIn();
      // } else {
      //   setUser(JSON.parse(sessionUser));
      // }
      await handleSignIn()
      sdk.actions.ready();
    })();
  }, []);

  const getNonce = useCallback(async (): Promise<string> => {
    console.log("getNonce called");
    try {
      const nonce = await generateNonce();
      if (!nonce) throw new Error("Unable to generate nonce");
      console.log("Nonce generated:", nonce);
      return nonce;
    } catch (error) {
      console.error("Error in getNonce:", error);
      throw error;
    }
  }, []);

  const handleSignIn = useCallback(async (): Promise<void> => {
    try {
      const nonce = await getNonce();

      await sdk.actions.signIn({ nonce });

      const {token} = await sdk.quickAuth.getToken()

      const createUserRes = await fetch(
          `${process.env.NEXT_PUBLIC_URL}/api/protected/handleUser`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
            }
          }
        );
        

        if (!createUserRes.ok) {
          console.error("Failed to create user:", await createUserRes.text());
        }
        setUser((await createUserRes.json()).user);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  }, [getNonce]);

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
