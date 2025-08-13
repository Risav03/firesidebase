"use client";

import { useRef, FormEvent } from "react";
import { useHMSActions } from "@100mslive/react-sdk";
import { ArrowRightIcon } from "@100mslive/react-icons";
import { useGlobalContext } from "@/utils/providers/globalContext";
import Image from "next/image";

export default function JoinForm() {
  const { user, setUser } = useGlobalContext();
  const hmsActions = useHMSActions();
  const roomCodeRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // use room code to fetch auth token
    console.log("roomCodeRef.current?.value", roomCodeRef.current?.value);
    const authToken = await hmsActions.getAuthTokenByRoomCode({
      roomCode: roomCodeRef.current?.value || "",
    });

    try {
      await hmsActions.join({
        userName: user.username || "Joinee",
        authToken,
        metaData: JSON.stringify({
          avatar: user.pfp_url,
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="clubhouse-card p-8 text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-fireside-orange rounded-3xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">🏠</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to Fireside
            </h1>
            <p className="text-gray-600">Join the conversation</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                ref={roomCodeRef}
                id="room-code"
                type="text"
                name="roomCode"
                placeholder="Room Code"
                className="clubhouse-input"
              />
            </div>
            <div className="flex flex-col items-center justify-center gap-2">
              {user ? <>
              <Image
                src={user.pfp_url}
                alt={`${user.username} profile`}
                className="rounded-full w-10 aspect-square"
              />
              <h2 className="text-lg font-bold text-gray-900">{user.username}</h2>
              </> : <>
                <div className="rounded-full w-10 aspect-square bg-black/10 animate-pulse"></div>
                <div className="w-16 rounded-full h-4 animate-pulse bg-black/10"></div>
              </>}
              
            </div>
            <button disabled={!user} className="clubhouse-button disabled:bg-clubhouse-orange/80 clubhouse-button-primary w-full flex items-center justify-center space-x-2">
              <span>{!user ? "Fetching profile..." : "Join Room "}</span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Drop-in audio chat with interesting people
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
