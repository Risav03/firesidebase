"use client";

import { useState } from "react";
import TestCallClient from "@/components/TestCallClient";

export default function TestPage() {
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);

  const handleJoin = () => {
    if (roomCode && userName) {
      setJoined(true);
    }
  };

  if (joined) {
    return <TestCallClient roomCode={roomCode} userName={userName} />;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          100ms Audio Test
        </h1>
        <div className="bg-gray-900 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-white mb-2">Room Code</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter 100ms room code"
              className="w-full px-4 py-2 rounded bg-black border border-gray-700 text-white"
            />
            <p className="text-gray-400 text-sm mt-1">
              You need a valid 100ms room code to join
            </p>
          </div>
          <div>
            <label className="block text-white mb-2">Your Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 rounded bg-black border border-gray-700 text-white"
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={!roomCode || !userName}
            className="w-full bg-fireside-orange text-white py-2 px-4 rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Join Test Room
          </button>
          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded">
            <p className="text-blue-300 text-sm mb-2">
              <strong>Testing Purpose:</strong> This route helps diagnose audio issues by bypassing authentication. 
            </p>
            <p className="text-gray-400 text-xs">
              Use this to test audio behavior in different environments (PWA, browser, iOS, desktop).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
