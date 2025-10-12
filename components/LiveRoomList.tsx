"use client";

import { useState, useEffect } from "react";
import { FaHeadphones } from "react-icons/fa";
import { IoIosRefresh } from "react-icons/io";
import { toast } from "react-toastify";
import { useGlobalContext } from "@/utils/providers/globalContext";
import UserDisplay from "./UserDisplay";
import SearchBar from "./UI/SearchBar";
import TopicSelector from "./TopicSelector";
import CreateRoomModal from "./CreateRoomModal";
import Countdown from "./Countdown";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  updateUserTopics,
  fetchUserByHandle,
  fetchAllRooms,
  fetchAPI,
  startRoom,
} from "@/utils/serverActions";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";

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
  strength: number;
  sponsorshipEnabled: boolean;
  topics: string[];
}

interface LiveRoomListProps {
  rooms?: Room[];
}

// Array of different welcome messages
const welcomeMessages = [
  "Which conversation would you like to join today?",
  "Ready to join an interesting discussion?",
  "Discover exciting conversations happening now!",
  "Find your next fascinating discussion!",
  "What topic interests you the most right now?",
  "Connect with others in meaningful conversations!",
  "Explore live discussions and join the conversation!",
  "Looking for an engaging chat? We've got you covered!",
  "Jump into a conversation that catches your interest!",
  "Ready to share your thoughts in a live discussion?",
];

export default function LiveRoomList({ rooms }: LiveRoomListProps) {
  const [localRooms, setLocalRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const { user, setUser, isUserLoading } = useGlobalContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();

  const [myUpcomingRooms, setMyUpcomingRooms] = useState<Room[]>([]);

  const navigate = useNavigateWithLoader()
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';


  // Handle topic selection and PATCH request
  const handleTopicSubmit = async (selectedTopics: string[]) => {
    try {
      var token: any = "";
      const env = process.env.NEXT_PUBLIC_ENV;

      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      const res = await updateUserTopics(selectedTopics, token);
      console.log("res", res);
      if (res.data.success) {
        toast.success("Topics updated!");

        // Refetch user
        const userData = await fetchUserByHandle(token);
        console.log("userData", userData);
        if (userData.data.success) {
          setUser(userData.data.data.user);
        }
      } else {
        toast.error(res.data.error || "Failed to update topics");
      }
    } catch (err) {
      toast.error("Error updating topics");
    }
  };

  // Fetch rooms client-side when user is loaded
  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetchAllRooms();

      if (response.data.success) {
        setLocalRooms(response.data.data.rooms);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Error loading rooms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyUpcomingRooms = async () => {
    try{
      var token:any ;
                const env = process.env.NEXT_PUBLIC_ENV;
                if (env !== "DEV" && !token) {
                  token = ((await sdk.quickAuth.getToken()).token);
                }
      const response = await fetchAPI(`${URL}/api/rooms/protected/upcoming`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      console.log("Fetch my upcoming rooms response:", response);

      if(response.data.success){
        setMyUpcomingRooms(response.data.data.rooms);
        console.log("My upcoming rooms:", response.data.data.rooms);
      }

    }
    catch(error){
      console.error("Error fetching my upcoming rooms:", error);
    }
  }

  const handleGoLive = async (roomId: string) => {
    try {
      var token: any = "";
      const env = process.env.NEXT_PUBLIC_ENV;

      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      toast.loading("Starting room...", { toastId: "starting-room" });

      const response = await startRoom(roomId, token);

      if (response.data.success) {
        const updatedRoom = response.data.data;
        toast.dismiss("starting-room");
        toast.success("Room started successfully!");
        
        // Navigate to the call page with the room ID
        navigate(`/call/${updatedRoom._id}`);
      } else {
        toast.dismiss("starting-room");
        toast.error(response.data.error || "Failed to start room");
      }
    } catch (error) {
      console.error("Error starting room:", error);
      toast.dismiss("starting-room");
      toast.error("Error starting room. Please try again.");
    }
  };


  // Refresh rooms client-side
  const refreshRooms = async () => {
    try {
      setLoading(true);
      const response = await fetchAllRooms();

      if (response.data.success) {
        setLocalRooms(response.data.data.rooms);
        toast.success("Rooms refreshed!");
      }
    } catch (error) {
      console.error("Error refreshing rooms:", error);
      toast.error("Error refreshing rooms. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch rooms when user is loaded
  useEffect(() => {
    if (!isUserLoading && user) {
      fetchRooms();
      fetchMyUpcomingRooms();
    }
  }, [user, isUserLoading]);

  // Handle initial rooms prop if provided
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      setLocalRooms(rooms);
      setLoading(false);
    }
  }, [rooms]);

  useEffect(() => {
    // Pick a random welcome message
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    setWelcomeMessage(welcomeMessages[randomIndex]);
  }, []);

  // Filter only live/ongoing rooms
  const liveRooms = localRooms.filter((room) => room.status === "ongoing");
  const upcomingRooms = localRooms.filter((room) => room.status === "upcoming");

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        <div className="text-left mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            Welcome,{" "}
            {isUserLoading ? (
              <div className="h-8 w-40 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <UserDisplay />
            )}
          </h1>
          <p className="text-white/70 text-sm">{welcomeMessage}</p>
        </div>

        <div className="mb-6">
          <SearchBar className="w-full" />
        </div>

        {/* Loading state - show when user is loading or rooms are loading */}
        {(isUserLoading || loading) && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2 w-full p-4 bg-white/5 rounded-lg animate-pulse"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-white/20 rounded mb-2"></div>
                  <div className="h-3 bg-white/10 rounded w-2/3"></div>
                </div>
                <div className="h-6 w-16 bg-white/20 rounded"></div>
              </div>
            ))}
          </div>
        )}

        {/* Topic selection if user.topics is empty */}
        {!isUserLoading && user?.topics?.length === 0 && (
          <TopicSelector onSubmit={handleTopicSubmit} />
        )}

        {/* Live Rooms Display */}
        {!loading && !isUserLoading && user && user?.topics?.length > 0 && (
          <div>
            {/* My Upcoming Rooms Section */}
            {myUpcomingRooms.length > 0 && (
              <div className="mb-8">
                <h2 className="text-white text-xl font-bold mb-6">
                  My Upcoming Rooms
                </h2>
                <div className="space-y-3">
                  {myUpcomingRooms.map((room) => (
                    <div
                      key={room._id}
                      className="gradient-emerald rounded-lg p-4  backdrop-blur-sm text-white"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Image
                            src={`${process.env.NEXT_PUBLIC_URL}/waves.gif`}
                            width={1920}
                            height={1080}
                            alt="Fireside Logo"
                            className="w-12 h-12 rounded-full absolute left-0 top-0 p-1 brightness-0 invert grayscale opacity-70"
                          />
                          <Image
                            width={1080}
                            height={1080}
                            src={room.host.pfp_url}
                            alt={room.host.displayName}
                            className="w-12 h-12 rounded-full border-2 border-white"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 justify-between">
                            <h3 className="text-lg text-white font-bold truncate">
                              {room.name}
                            </h3>
                            <button
                              onClick={() => handleGoLive(room._id)}
                              className="gradient-fire text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                            >
                              Go Live
                            </button>
                          </div>
                          
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-bold">
                Live Conversations
              </h2>
              {/* <button
                onClick={refreshRooms}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
              >
                <IoIosRefresh className="text-lg" />
                Refresh
              </button> */}
            </div>

            {liveRooms.length > 0 ? (
              <div className="space-y-3">
                {liveRooms.map((room) => (
                  <div
                    onClick={() => router.push(`/call/${room._id}`)}
                    key={room._id}
                    className={`flex items-center gap-3 w-full p-4 font-bold cursor-pointer hover:opacity-80 transition-opacity ${
                      room.sponsorshipEnabled
                        ? "gradient-red"
                        : "border border-orange-500 rounded-lg p-4 bg-white/5 backdrop-blur-sm flex items-center justify-between cursor-pointer hover:bg-orange-900/20 transition-colors"
                    } rounded-lg text-white`}
                  >
                    <div className="relative">
                      <Image
                        src={`${process.env.NEXT_PUBLIC_URL}/waves.gif`}
                        width={1920}
                        height={1080}
                        alt="Fireside Logo"
                        className="w-12 h-12 rounded-full absolute left-0 top-0 p-1 brightness-0 invert grayscale opacity-70"
                      />
                      <Image
                        width={1080}
                        height={1080}
                        src={room.host.pfp_url}
                        alt={room.host.displayName}
                        className="w-12 h-12 rounded-full border-2 border-white"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg text-white font-bold truncate">
                          {room.name.slice(0, 30)}
                          {room.name.length > 30 ? "..." : ""}
                        </h3>
                        <span className="text-white flex gap-1 items-center justify-center ml-2">
                          {room.strength || 0} <FaHeadphones />
                        </span>
                      </div>
                      <p className="text-white/80 text-sm truncate">
                        {room.description.slice(0, 60)}
                        {room.description.length > 60 ? "..." : ""}
                      </p>
                      <p className="text-white/70 text-xs">
                        Host: {room.host.displayName || room.host.username}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-left ">
                <p className="text-white/70 mb-4">
                  No live conversations right now
                </p>
                <button
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-md font-semibold"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create a Room
                </button>
              </div>
            )}

            {/* Upcoming Rooms Section */}
            {upcomingRooms.length > 0 && (
              <div className="mt-8">
                <h2 className="text-white text-xl font-bold mb-6">
                  Upcoming Conversations
                </h2>
                <div className="space-y-3 relative">
                  {upcomingRooms.map((room) => (
                    <div
                      onClick={() => navigate(`/room/${room._id}`)}
                      key={room._id}
                      className={`flex items-center gap-3 w-full p-4 font-bold cursor-pointer hover:opacity-80 transition-opacity gradient-yellow rounded-lg text-white`}
                    >
                      <div className="relative">
                        <Image
                          src={`${process.env.NEXT_PUBLIC_URL}/waves.gif`}
                          width={1920}
                          height={1080}
                          alt="Fireside Logo"
                          className="w-12 h-12 rounded-full absolute left-0 top-0 p-1 brightness-0 invert grayscale opacity-70"
                        />
                        <Image
                          width={1080}
                          height={1080}
                          src={room.host.pfp_url}
                          alt={room.host.displayName}
                          className="w-12 h-12 rounded-full border-2 border-white opacity-70"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg text-white font-bold truncate">
                            {room.name.slice(0, 30)}
                            {room.name.length > 30 ? "..." : ""}
                          </h3>
                        </div>

                        <p className="text-white/70 text-xs">
                          Host: {room.host.displayName || room.host.username}
                        </p>
                        <div className="absolute bottom-2 right-2 bg-black/10 rounded-full px-2 pb-1">
                          <Countdown
                            targetTime={room.startTime}
                            className="text-yellow-200 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CreateRoomModal */}
            <CreateRoomModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
