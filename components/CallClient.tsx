"use client";
import { useEffect, useState } from "react";
import {
  useHMSActions,
  useHMSStore,
  selectLocalPeer,
  selectIsConnectedToRoom,
} from "@100mslive/react-sdk";
import { useGlobalContext } from "@/utils/providers/globalContext";
import Conference from "@/components/Conference";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RoleChangeHandler from "@/components/RoleChangeHandler";
import AdsOverlay from "@/components/AdsOverlay";
import { Loader } from "@/components/Loader";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import {
  fetchAPI,
  fetchRoomCodes,
  addParticipantToRoom,
  removeParticipantFromRoom,
} from "@/utils/serverActions";

interface RoomCode {
  id: string;
  code: string;
  room_id: string;
  role: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface CallClientProps {
  roomId: string;
}

export default function CallClient({ roomId }: CallClientProps) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const { user } = useGlobalContext();
  const hmsActions = useHMSActions();

  const localPeer = useHMSStore(selectLocalPeer);
  const isConnected = useHMSStore(selectIsConnectedToRoom);

  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Request wake lock to keep screen active
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('[Wake Lock] Screen wake lock acquired');
        }
      } catch (err) {
        console.warn('[Wake Lock] Failed to acquire wake lock:', err);
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release();
        console.log('[Wake Lock] Screen wake lock released');
      }
    };
  }, []);

  useEffect(() => {
    const joinRoom = async () => {
      try {
        const env = process.env.NEXT_PUBLIC_ENV;

        console.log("[HMS Action - CallClient] Starting join process", {
          roomId,
          timestamp: new Date().toISOString(),
        });

        // Request microphone and camera permissions once at room join
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

        var token: any = "";
        if (env !== "DEV") {
          token = (await sdk.quickAuth.getToken()).token;
        }

        if (!user) {
          setError("User not authenticated");
          setIsJoining(false);
          return;
        }

        console.log("[HMS Action - CallClient] Joining room with ID:", roomId);

        const response = await fetchRoomCodes(roomId);

        console.log("[HMS Action - CallClient] Room codes response:", {
          success: response.ok,
          timestamp: new Date().toISOString(),
        });

        if (!response.ok) {
          throw new Error(response.data.error || "Failed to fetch room codes");
        }

        const roomCodes: RoomCode[] = response.data.data.roomCodes;

        let roomCode = "";
        let role = "listener";

        const roomResponse = await fetchAPI(
          `${URL}/api/rooms/public/${roomId}`
        );

        if (
          roomResponse.ok &&
          roomResponse.data.data.room.host._id === user._id
        ) {
          const hostCode = roomCodes.find((code) => code.role === "host");
          if (hostCode) {
            roomCode = hostCode.code;
            role = "host";
          }
        }

        if (!roomCode) {
          try {
            const response = await fetchAPI(
              `${URL}/api/rooms/protected/${roomId}/my-code`,
              {
                authToken: token,
              }
            );

            if (response.ok && response.data.success) {
              roomCode = response.data.data.code;
              role = response.data.data.role;
            } else {
              console.error("Failed to get user role:", response.data.error);
              // Fallback to listener role
              const listenerCode = roomCodes.find(
                (code) => code.role === "listener"
              );
              if (listenerCode) {
                roomCode = listenerCode.code;
                role = "listener";
              }
            }
          } catch (error) {
            console.error("Error fetching user role:", error);
            // Fallback to listener role
            const listenerCode = roomCodes.find(
              (code) => code.role === "listener"
            );
            if (listenerCode) {
              roomCode = listenerCode.code;
              role = "listener";
            }
          }
        }

        if (!roomCode) {
          throw new Error("No valid room code found");
        }

        const authToken = await hmsActions.getAuthTokenByRoomCode({
          roomCode: roomCode,
        });

        console.log("[HMS Action - CallClient] Joining room with role:", {
          role,
          userName: user.displayName || "Wanderer",
          timestamp: new Date().toISOString(),
        });

        await hmsActions.join({
          userName: user.displayName || "Wanderer",
          authToken,
          settings: {
            isAudioMuted: true,
            isVideoMuted: true,
          },
          
          rememberDeviceSelection: true,
          metaData: JSON.stringify({
            avatar: user.pfp_url,
            role: role,
            fid: user.fid,
            wallet: user.wallet || "",
          }),
        });

        console.log("[HMS Action - CallClient] Successfully joined room");
        setIsJoining(false);
      } catch (err) {
        console.error("[HMS Action - CallClient] Error joining room:", {
          error: err,
          timestamp: new Date().toISOString(),
        });
        setError(err instanceof Error ? err.message : "Failed to join room");
        setIsJoining(false);
        toast.error("Failed to join room. Please try again.");
      }
    };
    if (user && roomId) {
      joinRoom();
    }
  }, [roomId, user, hmsActions]);

  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

  useEffect(() => {
    if (isConnected && localPeer && user && !hasJoinedRoom) {
      const role = localPeer.roleName;

      console.log("[HMS Action - CallClient] Connected to room", {
        role,
        peerId: localPeer.id,
        peerName: localPeer.name,
        timestamp: new Date().toISOString(),
      });

      // Only auto-mute on initial join, not on subsequent peer updates
      if (role === "host" || role === "co-host" || role === "speaker") {
        console.log(
          "[HMS Action - CallClient] Auto-muting on join for role:",
          role
        );
        hmsActions.setLocalAudioEnabled(false);
      }

      // Add user as participant in Redis when they successfully join
      const addParticipantToRedis = async () => {
        const env = process.env.NEXT_PUBLIC_ENV;

        var token: any = "";
        if (env !== "DEV") {
          token = (await sdk.quickAuth.getToken()).token;
        }

        try {
          const response = await addParticipantToRoom(
            roomId,
            {
              userFid: user.fid,
              role: role || "listener",
            },
            token
          );

          if (response.ok && response.data.success) {
            // User added to Redis participants
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
      setHasJoinedRoom(true); // Mark that we've completed the initial join process
    }
  }, [isConnected, localPeer, hmsActions, user, roomId, hasJoinedRoom]);

  // Cleanup: Remove user from Redis participants when component unmounts or user leaves
  useEffect(() => {
    const removeParticipantFromRedis = async () => {
      const env = process.env.NEXT_PUBLIC_ENV;

      var token: any = "";
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
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
          // User removed from Redis participants
        } catch (error) {
          console.error("Error removing participant from Redis:", error);
        }
      }
    };

    // Remove participant on page unload/refresh
    const handleBeforeUnload = () => {
      removeParticipantFromRedis();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Also remove on component unmount
      removeParticipantFromRedis();
    };
  }, [user, roomId]);

  const navigate = useNavigateWithLoader();

  if (error && error !== "Failed to fetch room codes") {
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

  if (isJoining) {
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
      <RoleChangeHandler />
      <Header roomId={roomId} />
      {/* <AdsOverlay roomId={roomId} /> */}
      <Conference roomId={roomId} />
      <Footer roomId={roomId} />
    </div>
  );
}
