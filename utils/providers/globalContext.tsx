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
import { useAddFrame, useMiniKit, useNotification } from "@coinbase/onchainkit/minikit";
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

  const {context} = useMiniKit()

  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      var token: any;
      if (env !== "DEV" && !token) {
        const nonce = await getNonce();

        await sdk.actions.signIn({ nonce });

        token = (await sdk.quickAuth.getToken()).token;
      }

      const URL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const createUserRes = await fetchAPI(
        `${URL}/api/users/protected/handle`,
        {
          method: "POST",
          authToken: token,
        }
      );

      if (!createUserRes.ok) {
        console.error("Failed to create user:", createUserRes.data);
      }

      var localUser = createUserRes.data.data.user;
      if(context){
localUser.pfp_url = context?.user.pfpUrl;
      localUser.username = context?.user.username;
      }
      
      setUser(localUser);

      if (!localUser?.token || localUser?.token === "") {
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

        try {
          await sdk.actions.requestCameraAndMicrophoneAccess();
          console.log(
            "[HMS Action - CallClient] Microphone and camera permissions granted"
          );
        } catch (permissionError) {
          console.warn(
            "[HMS Action - CallClient] Microphone/camera permission denied:",
            permissionError
          );
          // Continue with room join even if permissions are denied
          // User can grant permissions later when they try to unmute
        }
      }
    })();
    // We're using hasRunRef to ensure this only runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GlobalContext.Provider
      value={{
        user,
        setUser,
        isUserLoading,
        setIsUserLoading,
        isPopupOpen,
        setIsPopupOpen,
      }}
    >
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
