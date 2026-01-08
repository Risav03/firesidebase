"use client";

import { useState, useEffect, Suspense } from "react";
import { FaPlay } from "react-icons/fa";
import { Card } from "@/components/UI/Card";
import Button from "@/components/UI/Button";
import { IoIosRefresh } from "react-icons/io";
import { toast } from "react-toastify";
import { useGlobalContext } from "@/utils/providers/globalContext";
import RoomsList from "./RoomsList";
import UserDisplay from "./UserDisplay";
import SearchBar from "./UI/SearchBar";
import TopicSelector from "./TopicSelector";
import CreateRoomModal from "./CreateRoomModal";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import { 
  updateUserTopics, 
  fetchUserByHandle, 
  fetchRoomsByTopics, 
  fetchAllRooms 
} from "@/utils/serverActions";

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

interface RecordingsProps {
  rooms: Room[];
}

export default function Recordings({ rooms }: RecordingsProps) {

  const [localRooms, setLocalRooms] = useState<Room[]>(rooms || []);
  const [loading, setLoading] = useState(!rooms || rooms.length === 0);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const { user, setUser, isUserLoading } = useGlobalContext();
  // Add state for selected tab (default to -1 for "All")
  const [selectedTab, setSelectedTab] = useState(-1);
  // Handle topic selection and PATCH request
  const handleTopicSubmit = async (selectedTopics: string[]) => {
    try {
      var token: any = "";
      const env = process.env.NEXT_PUBLIC_ENV;

      if (env !== "DEV") {
        token = ((await sdk.quickAuth.getToken()).token);
      }

      const res = await updateUserTopics(selectedTopics, token);
      
      if (res.data.success) {
        toast.success("Topics updated!");
        
        // Refetch user
        const userData = await fetchUserByHandle(token);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [topicRooms, setTopicRooms] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Fetch rooms by user's topics
  useEffect(() => {
    const getRoomsByTopics = async () => {
      if (user?.topics?.length > 0) {
        try {
          const res = await fetchRoomsByTopics(user.topics);
          
          if (res.data.success) {
            setTopicRooms(res.data.data.rooms);
          }
        } catch (err) {
          setTopicRooms([]);
        }
      }
    };
    getRoomsByTopics();
  }, [user?.topics]);

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

  // Handle search function
  // const handleSearch = (query: string) => {
  //   if (!query.trim()) {
  //     setSearchResults([]);
  //     return;
  //   }

  //   setIsLoading(true);

  //   // Filter rooms based on search query
  //   const filteredRooms = localRooms.filter(
  //     (room) =>
  //       room.name.toLowerCase().includes(query.toLowerCase()) ||
  //       room.description.toLowerCase().includes(query.toLowerCase()) ||
  //       room.host?.username.toLowerCase().includes(query.toLowerCase()) ||
  //       room.host?.displayName.toLowerCase().includes(query.toLowerCase())
  //   );

  //   // Convert to search results format
  //   const results = filteredRooms.map((room) => ({
  //     id: room._id,
  //     title: room.name,
  //     image: room.host?.pfp_url,
  //     description: room.description,
  //     hostName: room.host?.displayName || room.host?.username,
  //   }));

  //   setSearchResults(results);
  //   setIsLoading(false);
  // };

  useEffect(() => {
    if (rooms && rooms.length > 0) {
      setLocalRooms(rooms);
      setLoading(false);
    }
  }, [rooms]);

  const router = useRouter();

  const handlePlayRecording = (roomId: string) => {
    router.push(`/recordings/${roomId}`);
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        <div className="text-left mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white mb-2">
            Explore <span className="text-orange-500">Recordings</span>
          </h1>
          <p className="text-white/70 text-sm">Missed the live action? Catch up on all the tea you missed!</p>
        </div>

        {/* <div className="mb-6">
          <SearchBar className="w-full" />
        </div> */}
        
        {/* Topic selection if user.topics is empty */}
        {!isUserLoading && user?.topics?.length === 0 && (
          <TopicSelector onSubmit={handleTopicSubmit} />
        )}

        {!isUserLoading && user?.topics?.length > 0 && (
          <div>
            {/* <h2 className="text-white text-xl font-bold mb-4">
              Explore what you like!
            </h2> */}
            {/* Tabs for topics */}
            <div className="flex gap-2 mb-6 overflow-x-scroll hide-scrollbar">
              {/* All filter tab */}
              <Button
                variant="action"
                active={selectedTab === -1}
                onClick={() => setSelectedTab(-1)}
                className="text-nowrap"
              >
                All
              </Button>
              {user.topics.map((topic: string, idx: number) => (
                <Button
                  key={topic}
                  variant="action"
                  active={selectedTab === idx}
                  onClick={() => setSelectedTab(idx)}
                  className="text-nowrap"
                >
                  {topic}
                </Button>
              ))}
            </div>
            {/* Tab content for selected topic */}
            {(() => {
              const isAllSelected = selectedTab === -1;
              const topic = isAllSelected ? "All" : user.topics[selectedTab] as string;
              
              const ongoingRooms = isAllSelected 
                ? topicRooms.filter((r) => r.status === "ongoing")
                : topicRooms.filter((r) => r.status === "ongoing" && r.topics.includes(topic));
                
              const endedRooms = isAllSelected
                ? topicRooms.filter((r) => r.status === "ended")
                : topicRooms.filter((r) => r.status === "ended" && r.topics.includes(topic));
                
              return (
                <div key={topic} className="mb-10">
                  <h3 className="text-lg font-bold text-orange-400 mb-2">
                    {topic}
                  </h3>
                  {/* Ongoing rooms for this topic */}
                  {ongoingRooms.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-md font-semibold text-orange-500 mb-2">
                        Live Now!
                      </h4>
                      <div className="space-y-4">
                        {ongoingRooms.map((room) => (
                          <Card
                            key={room._id}
                            variant="orange"
                            className="p-4 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() =>
                              (window.location.href = `/call/${room._id}`)
                            }
                          >
                            <div>
                              <h4 className="text-lg font-bold text-white">
                                {room.name}
                              </h4>
                              <p className="text-white/70 text-sm">
                                {room.description.slice(0, 50)}{room.description.length > 50 ? "..." : ""}
                              </p>
                              <p className="text-white/60 text-xs mt-1">
                                Host:{" "}
                                {room.host?.displayName || room.host?.username}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {room.topics.map((t: string) => (
                                  <span
                                    key={t}
                                    className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <span className="bg-orange-600 text-white px-4 py-2 rounded font-bold">
                              Live
                            </span>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Ended rooms for this topic */}
                  {endedRooms.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-md font-semibold text-white mb-2">
                        Recordings
                      </h4>
                      <div className="space-y-4">
                        {endedRooms.map((room) => (
                          <Card
                            key={room._id}
                            variant="ghost"
                            className="p-4 flex items-center justify-between"
                          >
                            <div className="w-[85%]">
                              <h4 className="text-lg font-bold text-white">
                                {room.name}
                              </h4>
                              <p className="text-white/70 text-sm">
                                {room.description.slice(0, 50)}{room.description.length > 50 ? "..." : ""}
                              </p>
                              <p className="text-white/60 text-xs mt-1">
                                Host:{" "}
                                {room.host?.displayName || room.host?.username}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {room.topics.map((t: string) => (
                                  <span
                                    key={t}
                                    className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <Button 
                              variant="default"
                              onClick={() => { handlePlayRecording(room.roomId) }} 
                              className="w-[15%] aspect-square rounded flex items-center justify-center p-0"
                            >
                              <FaPlay className="" />
                            </Button>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* No rooms for this topic */}
                  {ongoingRooms.length === 0 && endedRooms.length === 0 && (
                    <div className="text-white/70 mb-4">
                      {isAllSelected 
                        ? "No conversations available yet. Be the first one to start a discussion!"
                        : "This topic hasn't been discussed yet. Be the first one to bring it to light."
                      }
                    </div>
                  )}
                  {/* Button to create room for this topic if no rooms exist */}
                  {/* {ongoingRooms.length === 0 && endedRooms.length === 0 && (
                    <button
                      className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-md font-semibold"
                      onClick={() => setShowCreateModal(true)}
                    >
                      Create Room
                    </button>
                  )} */}
                </div>
              );
            })()}
            {/* CreateRoomModal */}
            <CreateRoomModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
            />
          </div>
        )}

        {/* Rooms List and other sections remain unchanged (commented out) */}
      </div>
    </div>
  );
}