"use client";

/**
 * CallClientRTK - RealtimeKit version of CallClient
 * 
 * This component handles the room joining flow using Cloudflare RealtimeKit.
 * It replaces the 100ms-based CallClient during migration.
 * 
 * Key differences from 100ms version:
 * - Uses initAndJoin() (combined init + join) instead of hmsActions.join()
 * - Gets auth token from backend via fetchRealtimeKitToken()
 * - Uses meeting.self.on('roomJoined'/'roomLeft') for room state
 * - Uses participant.userId (not participant.id) for Stage APIs
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useGlobalContext } from "@/utils/providers/globalContext";
import { useRealtimeKit } from "@/utils/providers/realtimekit";
import ConferenceRTK from "@/components/ConferenceRTK";
import HeaderRTK from "@/components/HeaderRTK";
import FooterRTK from "@/components/FooterRTK";
import RoleChangeHandlerRTK from "@/components/RoleChangeHandlerRTK";
import AdsOverlay from "@/components/AdsOverlay";
import { Loader } from "@/components/Loader";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import {
  fetchRealtimeKitToken,
  addParticipantToRoom,
  removeParticipantFromRoom,
} from "@/utils/serverActions";
import { useAccount } from "wagmi";
import { debugLog } from "@/components/DebugLogger";

interface CallClientRTKProps {
  roomId: string;
}

export default function CallClientRTK({ roomId }: CallClientRTKProps) {
  const { address } = useAccount();
  const { user } = useGlobalContext();
  const { 
    meeting, 
    initAndJoin, 
    leaveRoom, 
    isConnected, 
    isJoining: isRtkJoining,
    error: rtkError 
  } = useRealtimeKit();

  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<string>("listener");
  
  // Ref to ensure we only attempt join once
  const hasAttemptedJoinRef = useRef(false);

  const navigate = useNavigateWithLoader();

  // Request wake lock to keep screen active
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('[Wake Lock] Failed to acquire wake lock:', err);
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, []);

  // Main join flow - runs once when user and roomId are available
  useEffect(() => {
    // Guard: Only attempt join once
    if (hasAttemptedJoinRef.current) {
      return;
    }
    
    // Guard: Wait for user to be loaded
    if (!user || !roomId) {
      return;
    }
    
    hasAttemptedJoinRef.current = true;
    
    const attemptJoin = async (): Promise<void> => {
      const env = process.env.NEXT_PUBLIC_ENV;

      // Get Farcaster auth token
      let farcasterToken = "";
      debugLog('info', `Environment: ${env}`);
      if (env !== "DEV") {
        try {
          debugLog('info', 'Getting Farcaster quickAuth token...');
          farcasterToken = (await sdk.quickAuth.getToken()).token;
          debugLog('info', `Got Farcaster token (${farcasterToken.length} chars)`);
        } catch (err: any) {
          debugLog('warn', 'Could not get Farcaster token', err?.message);
        }
      }

      try {
        // Step 1: Fetch RealtimeKit auth token from backend
        debugLog('info', `Fetching RTK auth token for room: ${roomId}`);
        const tokenResponse = await fetchRealtimeKitToken(roomId, farcasterToken);

        if (!tokenResponse.ok) {
          const errorMsg = tokenResponse.data?.error || "Failed to get auth token";
          debugLog('error', `Token fetch failed: ${errorMsg}`);
          
          // Check if room doesn't have RTK meeting yet
          if (errorMsg.includes("does not have an active RealtimeKit meeting")) {
            throw new Error("Room has not been started yet");
          }
          
          throw new Error(errorMsg);
        }

        const { authToken, preset, meetingId, userId } = tokenResponse.data.data;
        setCurrentPreset(preset);
        
        debugLog('info', `Got token - preset: ${preset}, meetingId: ${meetingId}`);
        
        // Debug: Log token details (first/last chars only for security)
        if (authToken) {
          debugLog('info', 'Token received', {
            length: authToken.length,
            starts: authToken.substring(0, 10) + '...',
            ends: '...' + authToken.substring(authToken.length - 10),
          });
        } else {
          debugLog('error', 'No auth token received!');
          throw new Error('No auth token received from backend');
        }

        // Step 2: Initialize AND join in one atomic call
        // This prevents race conditions between init and join
        debugLog('info', 'Calling initAndJoin...');
        await initAndJoin({
          authToken,
          defaults: {
            audio: false, // Start muted
            video: false, // Audio-only rooms
          },
        });

        debugLog('info', 'Successfully joined room!');
        setIsJoining(false);

      } catch (err: any) {
        debugLog('error', 'Error joining room', {
          message: err?.message,
          name: err?.name,
        });

        setError(err instanceof Error ? err.message : "Failed to join room");
        setIsJoining(false);
        
        // Only show toast for unexpected errors
        if (!err?.message?.includes("Room has not been started")) {
          toast.error("Failed to join room. Please try again.");
        }
      }
    };

    attemptJoin();
  }, [roomId, user]); // Only depend on roomId and user, not the functions

  // Handle post-join actions (add to Redis, mute based on role)
  useEffect(() => {
    if (isConnected && user && !hasJoinedRoom) {
      // Auto-mute speakers on initial join
      if (currentPreset === "host" || currentPreset === "co-host" || currentPreset === "speaker") {
        // RealtimeKit: Use meeting.self.disableAudio()
        if (meeting?.self) {
          meeting.self.disableAudio();
        }
      }

      // Add user as participant in Redis when they successfully join
      const addParticipantToRedis = async () => {
        const env = process.env.NEXT_PUBLIC_ENV;

        let token = "";
        if (env !== "DEV") {
          token = (await sdk.quickAuth.getToken()).token;
        }

        try {
          const response = await addParticipantToRoom(
            roomId,
            {
              userFid: user.fid,
              role: currentPreset || "listener",
            },
            token
          );

          if (response.ok && response.data.success) {
            console.log('[RTK] User added to Redis participants');
          } else {
            console.error(
              "Failed to add user to Redis participants:",
              response.data.error
            );
          }
        } catch (error) {
          console.error("Error adding participant to Redis:", error);
        }
      };

      addParticipantToRedis();
      setHasJoinedRoom(true);
    }
  }, [isConnected, meeting, user, roomId, hasJoinedRoom, currentPreset]);

  // Cleanup: Remove user from Redis participants when component unmounts
  // Use a ref to track if we actually joined (to avoid cleanup on React Strict Mode double-mount)
  const hasJoinedRef = useRef(false);
  
  useEffect(() => {
    // Update ref when we join
    if (hasJoinedRoom) {
      hasJoinedRef.current = true;
    }
  }, [hasJoinedRoom]);

  useEffect(() => {
    const removeParticipantFromRedis = async () => {
      const env = process.env.NEXT_PUBLIC_ENV;

      let token = "";
      if (env !== "DEV") {
        try {
          token = (await sdk.quickAuth.getToken()).token;
        } catch (e) {
          // Ignore token errors during cleanup
        }
      }

      if (user?.fid) {
        try {
          await removeParticipantFromRoom(
            roomId,
            {
              userFid: user.fid,
            },
            token
          );
          console.log('[RTK] User removed from Redis participants');
        } catch (error) {
          console.error("Error removing participant from Redis:", error);
        }
      }
    };

    // Remove participant on page unload/refresh
    const handleBeforeUnload = () => {
      if (hasJoinedRef.current) {
        removeParticipantFromRedis();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      
      // Only cleanup if we actually joined (prevents cleanup on React Strict Mode first unmount)
      if (hasJoinedRef.current) {
        removeParticipantFromRedis();
        leaveRoom();
        hasJoinedRef.current = false;
      }
    };
  }, [user, roomId, leaveRoom]);

  // Error states
  if (error && error !== "Failed to fetch room codes" && error !== "Room has not been started yet") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Error Joining Room
          </h1>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (error === "Room has not been started yet") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Room Not Started
          </h1>
          <p className="text-gray-400 mb-4">This room has not been started by the host yet.</p>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (error === "Failed to fetch room codes") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Room has already ended
          </h1>
          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isJoining || isRtkJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <RoleChangeHandlerRTK />
      <HeaderRTK roomId={roomId} />
      <AdsOverlay roomId={roomId} />
      <ConferenceRTK roomId={roomId} />
      <FooterRTK roomId={roomId} />
    </div>
  );
}

