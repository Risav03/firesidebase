"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { MdOutlineSchedule } from "react-icons/md";
import { GoDotFill } from "react-icons/go";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/UI/drawer";
import { generateNonce } from "@farcaster/auth-client";

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
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming'>('live');
  const router = useRouter();

  const hasRunRef = useRef(false);

  const [myUpcomingRooms, setMyUpcomingRooms] = useState<Room[]>([]);

  const navigate = useNavigateWithLoader()
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

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
    
    // Add an additional guard to prevent multiple concurrent executions
    if (hasRunRef.current) {
      console.log("handleSignIn already executed, skipping");
      return;
    }
    
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      var token:any ;
      if (env !== "DEV" && !token) {
        const nonce = await getNonce();

        await sdk.actions.signIn({ nonce });

        token = ((await sdk.quickAuth.getToken()).token);
      }

      const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const createUserRes = await fetchAPI(`${URL}/api/users/protected/handle`, {
        method: 'POST',
        authToken: token
      });

      if (!createUserRes.ok) {
        console.error("Failed to create user:", createUserRes.data);
      }
      
      const localUser = createUserRes.data.data.user;
      setUser(localUser);

      // if(!localUser?.token || localUser?.token === ""){
      //   setIsPopupOpen(true);
      // }
      // setIsUserLoading(false);
    } catch (error) {
      console.error("Sign in error:", error);
      // setIsUserLoading(false);
    }
  }, []); // Remove getNonce dependency to prevent recreation

  useEffect(() => {
    let isMounted = true; // Track if component is still mounted
    
    (async () => {
      // Double check the ref to prevent any race conditions
      if (hasRunRef.current || !isMounted) return;
      hasRunRef.current = true;
      
      console.log("GlobalProvider effect running - initializing sign in");
      
      // const sessionUser = sessionStorage.getItem("user");
      // if (!sessionUser) {
      //   await handleSignIn();
      // } else {
      //   setUser(JSON.parse(sessionUser));
      // }
      
      if (isMounted) {
        await handleSignIn();
        if (process.env.NEXT_PUBLIC_ENV !== "DEV") {
          sdk.actions.ready();
        }
      }
    })();
    
    // Cleanup function to prevent execution if component unmounts
    return () => {
      isMounted = false;
    };
    // We're using hasRunRef to ensure this only runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
  const upcomingRooms = localRooms.filter((room) => room.status === "upcoming" && room.startTime > new Date().toISOString());

  return (
    <div className="pt-16 min-h-screen pb-20">
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

        {/* <div className="mb-6">
          <SearchBar className="w-full" />
        </div> */}

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
            {/* Your Schedule Button */}
            {myUpcomingRooms.length > 0 && (
              <div className="mb-6">
                <Drawer>
                  <DrawerTrigger asChild>
                    
                    <button className="bg-white/5 border border-white/20 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2">
                      <MdOutlineSchedule className="text-lg text-white" />
                      Your Schedule ({myUpcomingRooms.length})
                    </button>
                  </DrawerTrigger>
                  <DrawerContent className="bg-black">
                    <DrawerHeader>
                      <DrawerTitle className="text-white text-xl font-bold">Your Scheduled Rooms</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 space-y-3">
                      {myUpcomingRooms.map((room) => (
                        <div
                          key={room._id}
                          className="border border-white/20 bg-white/5 rounded-lg p-4 backdrop-blur-sm text-white"
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative">
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
                                <DrawerClose asChild>
                                  <button
                                    onClick={() => handleGoLive(room._id)}
                                    className="gradient-fire text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                                  >
                                    Start
                                  </button>
                                </DrawerClose>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            )}

            {/* Toggle Buttons */}
            <div className="mb-6 flex gap-3 w-full">
              <button
                onClick={() => setActiveTab('live')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors w-1/2 duration-200 ${
                  activeTab === 'live'
                    ? 'gradient-fire text-white font-bold'
                    : 'bg-white/5 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              ><GoDotFill className="inline mb-1 mr-1 animate-pulse" />
                Live
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors w-1/2 duration-200 ${
                  activeTab === 'upcoming'
                    ? 'gradient-fire text-white font-bold'
                    : 'bg-white/5 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              ><MdOutlineSchedule className="inline mb-1 mr-1" />
                Upcoming 
              </button>
            </div>

            {/* Live Conversations Tab */}
            {activeTab === 'live' && (
              <div>
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
                  <div className="text-left">
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
              </div>
            )}

            {/* Upcoming Conversations Tab */}
            {activeTab === 'upcoming' && (
              <div>
                {upcomingRooms.length > 0 ? (
                  <div className="space-y-3 relative">
                    {upcomingRooms.map((room) => (
                      <div
                        onClick={() => navigate(`/room/${room._id}`)}
                        key={room._id}
                        className={`flex items-center gap-3 w-full p-4 font-bold cursor-pointer hover:opacity-80 transition-opacity gradient-yellow rounded-lg text-white`}
                      >
                        <div className="relative">
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
                ) : (
                  <div className="text-left">
                    <p className="text-white/70 mb-4">
                      No upcoming conversations scheduled
                    </p>
                    <button
                      className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-md font-semibold"
                      onClick={() => setShowCreateModal(true)}
                    >
                      Create a Room
                    </button>
                  </div>
                )}
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
