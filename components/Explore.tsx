"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaPlay } from "react-icons/fa";
import { IoIosArrowForward, IoIosRefresh } from "react-icons/io";
import toast from "react-hot-toast";

interface Room {
  _id: string;
  name: string;
  description: string;
  host: {
    fid: string;
    username: string;
    displayName: string;
    pfp_url: string;
  };
  status: string;
  startTime: string;
}

export default function Explore() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirectingRoomId, setRedirectingRoomId] = useState<string | null>(null);
  const router = useRouter();

  // Fetch rooms
  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/rooms");
      const data = await response.json();
      if (data.success) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error('Error fetching rooms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle room click
  const handleRoomClick = (room: Room) => {
    setRedirectingRoomId(room._id);
    router.push(`/call/${room._id}`);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-white mt-4">Loading rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Fireside
          </h1>
          <p className="text-white/70 text-base sm:text-lg px-4">
            Drop-in audio chat with interesting people
          </p>
        </div>

        {/* Rooms List */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-white/10">
          <div className="flex justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">
              Live Now!
            </h2>
            <button
              onClick={fetchRooms}
              className="bg-white/10 hover:bg-white/20 text-white p-2 aspect-square rounded-md transition-colors border border-white/20 hover:border-white/30"
            >
              <IoIosRefresh className="mx-auto" />
            </button>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-white/40 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p className="text-white/60 text-lg">No rooms available yet</p>
              <p className="text-white/40 mt-2">
                Be the first to create a room!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rooms.map((room) => (
                <div
                  key={room._id}
                  className={`border border-white/20 rounded-lg p-2 cursor-pointer flex items-center justify-between hover:bg-white/10 transition-colors group ${redirectingRoomId === room._id ? 'animate-pulse' : ''}`}
                  onClick={() => handleRoomClick(room)}
                >
                  <div className="flex flex-col sm:flex-row w-[90%] sm:items-start sm:justify-between gap-3 pr-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium truncate w-full text-white group-hover:text-fireside-orange transition-colors break-words">
                        {room.name}
                      </h3>
                      <div className="flex gap-2 text-white items-center text-xs">
                        <p className="text-white/70 mt-1 break-words leading-relaxed">
                          Hosted by:{" "}
                        </p>
                        <div className="flex items-center gap-1 ">
                          <div className="w-5 aspect-square rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                            {room.host?.pfp_url ? (
                              <img
                                src={room.host.pfp_url}
                                alt="Host"
                                className="w-5 aspect-square rounded-full object-cover"
                              />
                            ) : (
                              <svg
                                className="w-4 h-4 text-white/60"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                            )}
                          </div>
                          <span className="truncate">
                            {room.host?.displayName ||
                              room.host?.username ||
                              `FID: ${room.host?.fid}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button className="text-white hover:text-fireside-orange aspect-square rounded-md transition-colors w-[10%]">
                    {redirectingRoomId === room._id ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500 mx-auto"></div>
                    ) : (
                      <IoIosArrowForward className="mx-auto text-xl" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recordings Section */}
        <div className="mt-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4">
            Recently Ended
          </h2>
          <div className="space-y-4">
            {[...Array(5)].map((_, index) => (
              <div
                key={index}
                className="border border-white/20 rounded-lg p-4 bg-white/5 backdrop-blur-sm flex items-center justify-between"
              >
                <div>
                  <h3 className="text-lg font-medium text-white">
                    Recording {index + 1}
                  </h3>
                  <p className="text-white/70 text-sm">
                    Hosted by: username {index + 1}
                  </p>
                </div>
                <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 aspect-square rounded-md transition-colors">
                  <FaPlay className="mx-auto" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
