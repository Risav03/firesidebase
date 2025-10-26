"use client";
import { useEffect, useState } from "react";
import {
  useHMSActions,
  useHMSStore,
  selectLocalPeer,
  selectIsConnectedToRoom,
} from "@100mslive/react-sdk";
import Conference from "@/components/Conference";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Loader } from "@/components/Loader";
import { toast } from "react-toastify";

interface TestCallClientProps {
  roomCode: string;
  userName: string;
}

export default function TestCallClient({ roomCode, userName }: TestCallClientProps) {
  const hmsActions = useHMSActions();
  const localPeer = useHMSStore(selectLocalPeer);
  const isConnected = useHMSStore(selectIsConnectedToRoom);

  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate a random room ID for the test
  const roomId = "test-audio-room";

  useEffect(() => {
    const joinRoom = async () => {
      try {
        console.log("[TEST] Starting join process", {
          roomCode,
          userName,
          timestamp: new Date().toISOString(),
        });

        if (!roomCode || !userName) {
          throw new Error("Room code and user name are required");
        }

        // Get auth token from room code
        const authToken = await hmsActions.getAuthTokenByRoomCode({
          roomCode: roomCode,
        });

        console.log("[TEST] Joining room with auth token", {
          userName,
          timestamp: new Date().toISOString(),
        });

        // Join the room without any metadata
        await hmsActions.join({
          userName: userName,
          authToken,
        });

        console.log("[TEST] Successfully joined room");
        setIsJoining(false);
      } catch (err) {
        console.error("[TEST] Error joining room:", err);
        setError(err instanceof Error ? err.message : "Failed to join room");
        setIsJoining(false);
        toast.error("Failed to join room. Please check your room code.");
      }
    };

    joinRoom();
  }, [roomCode, userName, hmsActions]);

  useEffect(() => {
    if (isConnected && localPeer && !isJoining) {
      console.log("[TEST] Connected to room", {
        peerId: localPeer.id,
        peerName: localPeer.name,
        role: localPeer.roleName,
        timestamp: new Date().toISOString(),
      });
      
      // Auto-mute on join for testing
      console.log("[TEST] Auto-muting on join");
      hmsActions.setLocalAudioEnabled(false);
      
      // iOS autoplay fix: resume audio context if suspended
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const testContext = new AudioContext();
          if (testContext.state === 'suspended') {
            console.log("[TEST] Audio context suspended, attempting to resume");
            testContext.resume();
          }
          testContext.close();
        }
      } catch (error) {
        console.warn("[TEST] Could not check/resume audio context:", error);
      }
    }
  }, [isConnected, localPeer, isJoining, hmsActions]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="bg-red-900 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
            <p className="text-red-200 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-fireside-orange text-white py-2 px-4 rounded hover:bg-orange-600"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isJoining) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="relative">
        <Conference roomId={roomId} />
        <Footer roomId={roomId} />
      </div>
    </div>
  );
}


