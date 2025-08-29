"use client";

import { useState, useEffect, Suspense } from "react";
import { FaPlay } from "react-icons/fa";
import { IoIosRefresh } from "react-icons/io";
import toast from "react-hot-toast";
import { useGlobalContext } from "@/utils/providers/globalContext";
import RoomsList from "./RoomsList";
import UserDisplay from "./UserDisplay";
import SearchBar from "./UI/SearchBar";

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

interface ExploreProps {
  rooms: Room[];
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
  "Ready to share your thoughts in a live discussion?"
];

export default function Explore({ rooms }: ExploreProps) {
  const [localRooms, setLocalRooms] = useState<Room[]>(rooms || []);
  const [loading, setLoading] = useState(!rooms || rooms.length === 0);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const { user } = useGlobalContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Refresh rooms client-side
  const refreshRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/rooms");
      const data = await response.json();
      if (data.success) {
        setLocalRooms(data.rooms);
        toast.success('Rooms refreshed!');
      }
    } catch (error) {
      console.error("Error refreshing rooms:", error);
      toast.error('Error refreshing rooms. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle search function
  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsLoading(true);
    
    // Filter rooms based on search query
    const filteredRooms = localRooms.filter(room => 
      room.name.toLowerCase().includes(query.toLowerCase()) || 
      room.description.toLowerCase().includes(query.toLowerCase()) ||
      room.host.username.toLowerCase().includes(query.toLowerCase()) ||
      room.host.displayName.toLowerCase().includes(query.toLowerCase())
    );
    
    // Convert to search results format
    const results = filteredRooms.map(room => ({
      id: room._id,
      title: room.name,
      image: room.host.pfp_url,
      description: room.description,
      hostName: room.host.displayName || room.host.username
    }));
    
    setSearchResults(results);
    setIsLoading(false);
  };
  
  // Handle result click
  const handleResultClick = (result: any) => {
    // Navigate to room or perform other actions
    window.location.href = `/call/${result.id}`;
  };

  useEffect(()=>{
    console.log("Rooms prop changed:", rooms);
    if(rooms && rooms.length > 0){
      console.log("Setting localRooms with data from props");
      setLocalRooms(rooms);
      setLoading(false); // Set loading to false once we have rooms
    }
  },[rooms])

  useEffect(() => {
    // Pick a random welcome message
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    setWelcomeMessage(welcomeMessages[randomIndex]);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
        <div className="text-left mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white mb-2">
            Welcome, <UserDisplay />
          </h1>
          <p className="text-white/70 text-sm">
            {welcomeMessage}
          </p>
        </div>

        <div className="mb-6">
          <SearchBar
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              handleSearch(value);
            }}
            onSearch={handleSearch}
            results={searchResults}
            onResultClick={handleResultClick}
            loading={isLoading}
            className="w-full"
            resultsClassName="bg-gray-900/95 border-white/20"
          />
        </div>

        {/* Rooms List */}
        {/* <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-white/10">
          <div className="flex justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">
              Live Now!
            </h2>
            <button
              onClick={refreshRooms}
              disabled={loading}
              className="bg-white/10 hover:bg-white/20 text-white p-2 aspect-square rounded-md transition-colors border border-white/20 hover:border-white/30"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500 mx-auto"></div>
              ) : (
                <IoIosRefresh className="mx-auto" />
              )}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto"></div>
              <p className="text-white/60 mt-4">Loading rooms...</p>
            </div>
          ) : (
            <RoomsList rooms={localRooms} />
          )}
        </div> */}

        {/* Recordings Section */}
        {/* <div className="mt-8">
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
        </div> */}
      </div>
    </div>
  );
}
