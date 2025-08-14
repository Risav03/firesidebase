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

export default function RoomTest() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    host: '',
    startTime: ''
  });

  // Fetch rooms
  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms');
      const data = await response.json();
      if (data.success) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  // Create room
  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          startTime: new Date(formData.startTime).toISOString()
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Room created successfully!');
        setFormData({ name: '', description: '', host: '', startTime: '' });
        fetchRooms(); // Refresh the list
      } else {
        alert('Error creating room: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Error creating room');
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-8">Room Management Test</h1>
      
      {/* Create Room Form */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Create New Room</h2>
        <form onSubmit={createRoom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              rows={3}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Host FID
            </label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData({...formData, host: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              placeholder="Enter FID (e.g., 12345)"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({...formData, startTime: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </form>
      </div>

      {/* Rooms List */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Existing Rooms</h2>
        <button
          onClick={fetchRooms}
          className="mb-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          Refresh Rooms
        </button>
        
        {rooms.length === 0 ? (
          <p className="text-gray-400">No rooms found</p>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => (
              <div 
                key={room._id} 
                className="border border-gray-600 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => handleRoomClick(room)}
              >
                <h3 className="text-lg font-medium text-white">{room.name}</h3>
                <p className="text-gray-300 mt-1">{room.description}</p>
                <div className="mt-2 text-sm text-gray-400">
                  <p>Host: {room.host?.displayName || room.host?.username || room.host?.fid}</p>
                  <p>Status: {room.status}</p>
                  <p>Start Time: {new Date(room.startTime).toLocaleString()}</p>
                  <p className="text-blue-400 mt-2">Click to join room →</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
