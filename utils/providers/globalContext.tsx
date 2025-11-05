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
import { fetchAPI } from "@/utils/serverActions";

interface GlobalContextProps {
  user: any;
  setUser: (value: any) => void;
  isUserLoading: boolean;
  setIsUserLoading: (value: boolean) => void;
  isPopupOpen: boolean;
  setIsPopupOpen: (value: boolean) => void;
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(true);
  const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);
  
  // Ref to ensure sign-in only runs once across component re-renders
  const hasRunRef = React.useRef(false);

  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  // useEffect for sign-in moved to a single place with hasRunRef check below

  const getNonce = useCallback(async (): Promise<string> => {
    try {
      const nonce = await generateNonce();
      if (!nonce) throw new Error("Unable to generate nonce");
      return nonce;
    } catch (error) {
      console.error("Error in getNonce:", error);
      throw error;
    }
  }, []);

  const handleSignIn = useCallback(async (): Promise<void> => {
    console.log("handleSignIn called", new Date().toISOString());
    
    // Add an additional guard to prevent multiple concurrent executions
    if (hasRunRef.current) {
      console.log("handleSignIn already executed, skipping");
      return;
    }
    
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      var token:any ;
      if (env !== "DEV" && !token) {
        const nonce = await getNonce();

        await sdk.actions.signIn({ nonce });

        token = ((await sdk.quickAuth.getToken()).token);
      }

      const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const createUserRes = await fetchAPI(`${URL}/api/users/protected/handle`, {
        method: 'POST',
        authToken: token
      });

      if (!createUserRes.ok) {
        console.error("Failed to create user:", createUserRes.data);
      }
      
      const localUser = createUserRes.data.data.user;
      setUser(localUser);

      if(!localUser?.token || localUser?.token === ""){
        setIsPopupOpen(true);
      }
      setIsUserLoading(false);
    } catch (error) {
      console.error("Sign in error:", error);
      setIsUserLoading(false);
    }
  }, []); // Remove getNonce dependency to prevent recreation

  useEffect(() => {
    let isMounted = true; // Track if component is still mounted
    
    (async () => {
      // Double check the ref to prevent any race conditions
      if (hasRunRef.current || !isMounted) return;
      hasRunRef.current = true;
      
      console.log("GlobalProvider effect running - initializing sign in");
      
      // const sessionUser = sessionStorage.getItem("user");
      // if (!sessionUser) {
      //   await handleSignIn();
      // } else {
      //   setUser(JSON.parse(sessionUser));
      // }
      
      if (isMounted) {
        await handleSignIn();
        if (process.env.NEXT_PUBLIC_ENV !== "DEV") {
          sdk.actions.ready();
        }
      }
    })();
    
    // Cleanup function to prevent execution if component unmounts
    return () => {
      isMounted = false;
    };
    // We're using hasRunRef to ensure this only runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GlobalContext.Provider value={{ user, setUser, isUserLoading, setIsUserLoading, isPopupOpen, setIsPopupOpen }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalContext() {
  const context = useContext(GlobalContext);
  if (!context) {
    // Return a mock context for test mode
    return {
      user: null,
      setUser: () => {},
      isUserLoading: false,
      setIsUserLoading: () => {},
      isPopupOpen: false,
      setIsPopupOpen: () => {},
    };
  }
  return context;
}
