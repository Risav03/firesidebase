'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  // Fetch rooms
  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rooms');
      const data = await response.json();
      if (data.success) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle room click
  const handleRoomClick = (room: Room) => {
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
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Fireside</h1>
          <p className="text-white/70 text-base sm:text-lg px-4">Drop-in audio chat with interesting people</p>
        </div>
        
        {/* Rooms List */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-white/10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Latest Rooms</h2>
            <button
              onClick={fetchRooms}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-md transition-colors border border-white/20 hover:border-white/30"
            >
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          
          {rooms.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-white/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-white/60 text-lg">No rooms available yet</p>
              <p className="text-white/40 mt-2">Be the first to create a room!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rooms.map((room) => (
                <div 
                  key={room._id} 
                  className="border border-white/20 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors group"
                  onClick={() => handleRoomClick(room)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-white group-hover:text-orange-400 transition-colors break-words">
                        {room.name}
                      </h3>
                      <p className="text-white/70 mt-1 break-words leading-relaxed">{room.description}</p>
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-white/60">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                            {room.host?.pfp_url ? (
                              <img 
                                src={room.host.pfp_url} 
                                alt="Host" 
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            )}
                          </div>
                          <span className="truncate">{room.host?.displayName || room.host?.username || `FID: ${room.host?.fid}`}</span>
                        </div>
                        <div className="hidden sm:block text-white/40">•</div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          room.status === 'live' ? 'bg-orange-600 text-white' : 
                          room.status === 'scheduled' ? 'bg-orange-500/80 text-white' : 
                          'bg-white/20 text-white'
                        }`}>
                          {room.status}
                        </span>
                        <div className="hidden sm:block text-white/40">•</div>
                        <span className="text-white/60">{new Date(room.startTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
