'use client'

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useHMSActions, useHMSStore, selectLocalPeer } from '@100mslive/react-sdk';
import { useGlobalContext } from '@/utils/providers/globalContext';
import Conference from '@/components/Conference';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Loader } from '@/components/Loader';

interface RoomCode {
  id: string;
  code: string;
  room_id: string;
  role: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export default function CallPage() {
  const params = useParams();
  const roomId = params.id as string;
  const { user } = useGlobalContext();
  const hmsActions = useHMSActions();
  const localPeer = useHMSStore(selectLocalPeer);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [roomCodes, setRoomCodes] = useState<RoomCode[]>([]);
  const lastRoleCheck = useRef<number>(0);
  const roleCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Function to join room with specific role
  const joinRoomWithRole = async (role: string) => {
    try {
      const targetCode = roomCodes.find(code => code.role === role);
      if (!targetCode) {
        throw new Error(`No room code found for role: ${role}`);
      }

      console.log(`Joining room with role: ${role}`);
      
      // Get auth token using room code
      const authToken = await hmsActions.getAuthTokenByRoomCode({
        roomCode: targetCode.code,
      });

      // Join the room
      await hmsActions.join({
        userName: user.username || user.displayName || 'Anonymous',
        authToken,
        metaData: JSON.stringify({
          avatar: user.pfp_url,
          role: role,
          fid: user.fid
        })
      });

      setCurrentRole(role);
      console.log(`Successfully joined with role: ${role}`);
    } catch (err) {
      console.error(`Error joining room with role ${role}:`, err);
      throw err;
    }
  };

  // Function to check and update role if needed
  const checkAndUpdateRole = async () => {
    try {
      // Throttle role checks to avoid too many API calls
      const now = Date.now();
      if (now - lastRoleCheck.current < 5000) { // 5 second throttle
        return;
      }
      lastRoleCheck.current = now;

      console.log("Checking for role updates...");
      
      // Fetch current room details to check user's role
      const roomResponse = await fetch(`/api/rooms/${roomId}`);
      const roomData = await roomResponse.json();
      
      if (!roomData.success) {
        console.log("Failed to fetch room data for role check");
        return;
      }

      // Determine what role the user should have
      let targetRole = 'listener';
      if (roomData.room.host._id === user._id) {
        targetRole = 'host';
      }

      // If role changed, re-join with new role
      if (targetRole !== currentRole && targetRole !== '') {
        console.log(`Role changed from ${currentRole} to ${targetRole}, re-joining...`);
        
        // Leave current room
        await hmsActions.leave();
        
        // Small delay to ensure clean disconnect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Re-join with new role
        await joinRoomWithRole(targetRole);
      }
    } catch (err) {
      console.error('Error checking role updates:', err);
    }
  };

  // Initial room join
  useEffect(() => {
    const joinRoom = async () => {
      try {
        if (!user) {
          setError('User not authenticated');
          setIsJoining(false);
          return;
        }

        // Fetch room codes from our API
        const response = await fetch(`/api/rooms/${roomId}/codes`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch room codes');
        }

        const fetchedRoomCodes: RoomCode[] = data.roomCodes;
        setRoomCodes(fetchedRoomCodes);
        
        // Determine user role - if user is host, use host code, otherwise use listener code
        let roomCode = '';
        let role = 'listener';
        
        // Check if user is host (you might need to fetch room details to check this)
        const roomResponse = await fetch(`/api/rooms/${roomId}`);
        const roomData = await roomResponse.json();
        
        console.log("roomCodes", fetchedRoomCodes);
        console.log("user", user);
        console.log("roomData", roomData);
        if (roomData.success && roomData.room.host._id === user._id) {
          // User is host, find host code
          const hostCode = fetchedRoomCodes.find(code => code.role === 'host');
          if (hostCode) {
            roomCode = hostCode.code;
            role = 'host';
          }
        }
        
        // If not host or host code not found, use listener code
        if (!roomCode) {
          const listenerCode = fetchedRoomCodes.find(code => code.role === 'listener');
          if (listenerCode) {
            roomCode = listenerCode.code;
            role = 'listener';
          }
        }

        if (!roomCode) {
          throw new Error('No valid room code found');
        }

        // Get auth token using room code
        const authToken = await hmsActions.getAuthTokenByRoomCode({
          roomCode: roomCode,
        });

        // Join the room
        await hmsActions.join({
          userName: user.username || user.displayName || 'Anonymous',
          authToken,
          metaData: JSON.stringify({
            avatar: user.pfp_url,
            role: role,
            fid: user.fid
          })
        });

        setCurrentRole(role);
        setIsJoining(false);
      } catch (err) {
        console.error('Error joining room:', err);
        setError(err instanceof Error ? err.message : 'Failed to join room');
        setIsJoining(false);
      }
    };

    joinRoom();
  }, [roomId, user, hmsActions]);

  // Set up periodic role checking
  useEffect(() => {
    if (!isJoining && roomCodes.length > 0) {
      // Check for role updates every 10 seconds
      roleCheckInterval.current = setInterval(checkAndUpdateRole, 10000);
      
      return () => {
        if (roleCheckInterval.current) {
          clearInterval(roleCheckInterval.current);
        }
      };
    }
  }, [isJoining, roomCodes]);

  // Update current role when local peer changes
  useEffect(() => {
    if (localPeer && localPeer.roleName) {
      setCurrentRole(localPeer.roleName);
    }
  }, [localPeer]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error Joining Room</h1>
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => window.history.back()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="text-white mt-4">Joining room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900">
      <Header />
      <Conference />
      <Footer />
    </div>
  );
}
