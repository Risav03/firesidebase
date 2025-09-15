"use client";

// import { useMiniKit } from "@coinbase/onchainkit/minikit";
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
import { useAddFrame, useNotification } from "@coinbase/onchainkit/minikit";

interface GlobalContextProps {
  user: any;
  setUser: (value: any) => void;
  isUserLoading: boolean;
  setIsUserLoading: (value: boolean) => void;
  isPopupOpen: boolean;
  setIsPopupOpen: (value: boolean) => void;
  handleAddFrame: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(true);
  const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);
  
  const addFrame = useAddFrame();
  const sendNotification = useNotification();

  const handleAddFrame = async () => {
    try {
      var token:any ;
      const env = process.env.NEXT_PUBLIC_ENV;
      if (env !== "DEV" && !token) {
        token = ((await sdk.quickAuth.getToken()).token);
      }
      const result = await addFrame();
      const URL = process.env.BACKEND_URL || 'http://localhost:8000';
      console.log("addFrame result:", result);
      
      if (result) {
        await fetch(`${URL}/api/protected/user/handle`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: result.token || Date.now(),
          }),
        });

        await sendNotification({
          title: "Notification Enabled",
          body: "You chose the best channel to receive Base news!",
        });

        setTimeout(() => {
          setIsPopupOpen(false);
        }, 2000);

        window.location.reload();
      }
    } catch (error) {
      console.error("Error saving notification details:", error);
    } finally {
      setIsPopupOpen(false);
    }
  };
  const URL = process.env.BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    (async () => {
      // const sessionUser = sessionStorage.getItem("user");

      // if (!sessionUser) {
      //   await handleSignIn();
      // } else {
      //   setUser(JSON.parse(sessionUser));
      // }
      await handleSignIn();
      if(process.env.NEXT_PUBLIC_ENV !== "DEV"){
        sdk.actions.ready();
      }
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

      const env = process.env.NEXT_PUBLIC_ENV;
      console.log("Environment:", env);
      var token:any ;
      if (env !== "DEV" && !token) {
        const nonce = await getNonce();

        await sdk.actions.signIn({ nonce });

        token = ((await sdk.quickAuth.getToken()).token);
      }

      console.log("Authorization token:", token);
      console.log("user", user)

      const createUserRes = await fetch(
        `${URL}/api/users/protected/handle`,
        {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`
          },
        }
      );

      if (!createUserRes.ok) {
        console.error("Failed to create user:", await createUserRes.text());
      }
      const localUser = (await createUserRes.json()).data.user;
      setUser(localUser);

      if(!localUser?.token || localUser?.token === ""){
        setIsPopupOpen(true);
      }
      setIsUserLoading(false);
    } catch (error) {
      console.error("Sign in error:", error);
      setIsUserLoading(false);
    }
  }, [getNonce]);

  const hasRunRef = React.useRef(false);

  useEffect(() => {
    (async () => {
      if (hasRunRef.current) return;
      hasRunRef.current = true;
      // const sessionUser = sessionStorage.getItem("user");
      // if (!sessionUser) {
      //   await handleSignIn();
      // } else {
      //   setUser(JSON.parse(sessionUser));
      // }
      await handleSignIn();
      if (process.env.NEXT_PUBLIC_ENV !== "DEV") {
        sdk.actions.ready();
      }
    })();
  }, []);

  return (
    <GlobalContext.Provider value={{ user, setUser, isUserLoading, setIsUserLoading, isPopupOpen, setIsPopupOpen, handleAddFrame }}>
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
