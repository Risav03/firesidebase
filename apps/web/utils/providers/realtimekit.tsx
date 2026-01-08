"use client";

import { 
  RealtimeKitProvider, 
  useRealtimeKitClient,
  useRealtimeKitMeeting,
  useRealtimeKitSelector 
} from "@cloudflare/realtimekit-react";
import { ReactNode, createContext, useContext, useState, useCallback, useRef } from "react";
import { debugLog } from "@/components/DebugLogger";

/**
 * RealtimeKit Context for managing meeting state across the app
 * 
 * Based on: https://docs.realtime.cloudflare.com/guides/live-video/client-setup/react
 */

interface RealtimeKitContextType {
  meeting: any;
  initAndJoin: (config: { authToken: string; defaults?: { audio?: boolean; video?: boolean } }) => Promise<void>;
  isInitialized: boolean;
  isJoining: boolean;
  isConnected: boolean;
  error: string | null;
  leaveRoom: () => Promise<void>;
}

const RealtimeKitContext = createContext<RealtimeKitContextType | null>(null);

interface RealtimeKitWrapperProps {
  children: ReactNode;
}

/**
 * RealtimeKitWrapper - Initializes and provides the RealtimeKit meeting context
 * 
 * This component:
 * 1. Creates the meeting client with useRealtimeKitClient
 * 2. Wraps children with RealtimeKitProvider
 * 3. Exposes initAndJoin which handles the full lifecycle (init -> join) atomically
 */
export function RealtimeKitWrapper({ children }: RealtimeKitWrapperProps) {
  const [meeting, initMeetingFn] = useRealtimeKitClient();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to prevent concurrent join attempts
  const joinInProgressRef = useRef(false);

  /**
   * Initialize AND join the meeting in one atomic operation
   * This prevents race conditions between init and join
   * 
   * Based on: https://docs.realtime.cloudflare.com/web-core
   */
  const initAndJoin = useCallback(async (config: { 
    authToken: string; 
    defaults?: { audio?: boolean; video?: boolean } 
  }) => {
    // Prevent concurrent calls
    if (joinInProgressRef.current) {
      debugLog('warn', 'Join already in progress, skipping');
      return;
    }
    
    joinInProgressRef.current = true;
    setIsJoining(true);
    setError(null);
    
    try {
      debugLog('info', 'Initializing meeting...');
      
      // Debug: Log browser/WebView environment info
      if (typeof window !== 'undefined') {
        const ua = navigator.userAgent;
        debugLog('info', 'User Agent', ua.substring(0, 100));
        debugLog('info', 'Environment check', {
          isWebView: /wv|WebView/i.test(ua),
          isFarcaster: /Farcaster/i.test(ua),
          isIOS: /iPhone|iPad|iPod/i.test(ua),
          hasWebRTC: !!(window as any).RTCPeerConnection,
          hasMediaDevices: !!navigator.mediaDevices,
        });
      }
      
      // Debug: Decode and log token payload (JWT is base64)
      try {
        const tokenParts = config.authToken.split('.');
        debugLog('info', `Token has ${tokenParts.length} parts`);
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          debugLog('info', 'Token payload decoded', {
            preset: payload.preset,
            presetName: payload.presetName,
            preset_name: payload.preset_name,
            role: payload.role,
            keys: Object.keys(payload),
          });
        }
      } catch (e: any) {
        debugLog('warn', 'Could not decode token payload', e?.message);
      }
      
      // Step 1: Initialize the meeting
      let meetingInstance;
      try {
        debugLog('info', 'Calling initMeetingFn...');
        meetingInstance = await initMeetingFn({
          authToken: config.authToken,
          defaults: {
            audio: config.defaults?.audio ?? false,
            video: config.defaults?.video ?? false,
          },
        });
        debugLog('info', 'initMeetingFn returned', { hasMeeting: !!meetingInstance });
      } catch (initError: any) {
        debugLog('error', 'initMeetingFn failed', {
          message: initError?.message,
          stack: initError?.stack?.substring(0, 300),
        });
        throw initError;
      }
      
      setIsInitialized(true);
      debugLog('info', 'Meeting initialized, joining...');
      
      // Step 2: Set up room event listeners
      const handleRoomJoined = () => {
        debugLog('info', 'Room joined event received');
        setIsConnected(true);
        setIsJoining(false);
      };
      
      const handleRoomLeft = () => {
        debugLog('info', 'Room left event received');
        setIsConnected(false);
        setIsInitialized(false);
      };
      
      // The meetingInstance is returned from initMeetingFn
      // Use it directly instead of relying on state
      if (meetingInstance?.self) {
        meetingInstance.self.on('roomJoined', handleRoomJoined);
        meetingInstance.self.on('roomLeft', handleRoomLeft);
      }
      
      // Step 3: Join the room
      if (!meetingInstance) {
        debugLog('error', 'Meeting instance is null after init!');
        throw new Error('Meeting instance not initialized');
      }
      debugLog('info', 'Calling meetingInstance.join()...');
      await meetingInstance.join();
      
      debugLog('info', 'Successfully joined room!');
      
    } catch (err: any) {
      debugLog('error', 'Init/Join error', err?.message);
      debugLog('error', 'Error details', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack?.substring(0, 500),
        code: err?.code,
      });
      
      // Provide more helpful error message
      let errorMessage = 'Failed to join room';
      if (err?.message?.includes('r.name.toLowerCase')) {
        errorMessage = 'Invalid preset configuration. Check RealtimeKit dashboard presets.';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsJoining(false);
      throw err;
    } finally {
      joinInProgressRef.current = false;
    }
  }, [initMeetingFn]);

  /**
   * Leave the room
   */
  const leaveRoom = useCallback(async () => {
    if (!meeting) return;
    
    try {
      await meeting.leave();
      setIsConnected(false);
      setIsInitialized(false);
      joinInProgressRef.current = false;
      debugLog('info', 'Left room');
    } catch (err: any) {
      debugLog('error', 'Leave error', err?.message);
      // Don't throw - we want to allow cleanup even if leave fails
    }
  }, [meeting]);

  const contextValue: RealtimeKitContextType = {
    meeting,
    initAndJoin,
    isInitialized,
    isJoining,
    isConnected,
    error,
    leaveRoom,
  };

  // Only wrap with RealtimeKitProvider when meeting is initialized
  // Otherwise, render children directly to avoid blocking the UI
  return (
    <RealtimeKitContext.Provider value={contextValue}>
      {meeting ? (
        <RealtimeKitProvider value={meeting}>
          {children}
        </RealtimeKitProvider>
      ) : (
        children
      )}
    </RealtimeKitContext.Provider>
  );
}

/**
 * Hook to access RealtimeKit context
 */
export function useRealtimeKit() {
  const context = useContext(RealtimeKitContext);
  
  if (!context) {
    // Return mock context for when not in a call
    return {
      meeting: null,
      initAndJoin: async () => {},
      isInitialized: false,
      isJoining: false,
      isConnected: false,
      error: null,
      leaveRoom: async () => {},
    };
  }
  
  return context;
}

// Re-export RealtimeKit hooks for convenience
export { 
  useRealtimeKitMeeting, 
  useRealtimeKitSelector,
  useRealtimeKitClient 
};

