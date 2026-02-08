"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useAccount, useWalletClient } from "wagmi";
import { Client } from "@xmtp/browser-sdk";
import type { Signer } from "@xmtp/browser-sdk";
import { IdentifierKind } from "@xmtp/browser-sdk";

interface XMTPContextProps {
  client: Client | null;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  initializeClient: () => Promise<void>;
  disconnectClient: () => void;
}

const XMTPContext = createContext<XMTPContextProps | undefined>(undefined);

export function XMTPProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const initializeClient = useCallback(async () => {
    if (!address || !walletClient || !isConnected) {
      setError("Wallet not connected");
      return;
    }

    if (isInitializing || isInitialized) {
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Create XMTP signer from wallet client
      const signer: Signer = {
        type: "EOA",
        getIdentifier: () => ({
          identifier: address,
          identifierKind: IdentifierKind.Ethereum,
        }),
        signMessage: async (message: string): Promise<Uint8Array> => {
          try {
            const signature = await walletClient.signMessage({
              message,
            });

            // Convert hex signature to Uint8Array
            const signatureBytes = new Uint8Array(
              signature.slice(2).match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
            );

            return signatureBytes;
          } catch (err) {
            console.error("Error signing message:", err);
            throw err;
          }
        },
      };

      // Create XMTP client
      const xmtpClient = await Client.create(signer, {
        env: process.env.NEXT_PUBLIC_XMTP_ENV === "production" ? "production" : "dev",
        // Browser SDK uses IndexedDB automatically, no dbPath needed
      });

      setClient(xmtpClient);
      setIsInitialized(true);
      console.log("XMTP client initialized successfully");
    } catch (err: any) {
      console.error("Failed to initialize XMTP client:", err);
      setError(err.message || "Failed to initialize XMTP client");
      setClient(null);
      setIsInitialized(false);
    } finally {
      setIsInitializing(false);
    }
  }, [address, walletClient, isConnected, isInitializing, isInitialized]);

  const disconnectClient = useCallback(() => {
    setClient(null);
    setIsInitialized(false);
    setError(null);
    console.log("XMTP client disconnected");
  }, []);

  // Auto-initialize when wallet connects
  useEffect(() => {
    if (isConnected && address && walletClient && !isInitialized && !isInitializing) {
      // Small delay to ensure wallet is fully ready
      const timer = setTimeout(() => {
        initializeClient();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isConnected, address, walletClient, isInitialized, isInitializing, initializeClient]);

  // Disconnect when wallet disconnects
  useEffect(() => {
    if (!isConnected && isInitialized) {
      disconnectClient();
    }
  }, [isConnected, isInitialized, disconnectClient]);

  return (
    <XMTPContext.Provider
      value={{
        client,
        isInitialized,
        isInitializing,
        error,
        initializeClient,
        disconnectClient,
      }}
    >
      {children}
    </XMTPContext.Provider>
  );
}

export function useXMTP() {
  const context = useContext(XMTPContext);
  if (context === undefined) {
    throw new Error("useXMTP must be used within XMTPProvider");
  }
  return context;
}
