'use client'
import { useEffect, useState } from 'react';
import { useHMSActions, useHMSStore, selectLocalPeer, selectIsConnectedToRoom } from '@100mslive/react-sdk';
import { useGlobalContext } from '@/utils/providers/globalContext';
import Conference from '@/components/Conference';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RoleChangeHandler from '@/components/RoleChangeHandler';
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

interface CallClientProps {
  roomId: string;
}

export default function CallClient({ roomId }: CallClientProps) {
  const { user } = useGlobalContext();
  const hmsActions = useHMSActions();

  const localPeer = useHMSStore(selectLocalPeer);
  const isConnected = useHMSStore(selectIsConnectedToRoom);

  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const joinRoom = async () => {
      try {
        if (!user) {
          setError('User not authenticated');
          setIsJoining(false);
          return;
        }

        const response = await fetch(`/api/rooms/${roomId}/codes`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch room codes');
        }

        const roomCodes: RoomCode[] = data.roomCodes;

        let roomCode = '';
        let role = 'listener';

        const roomResponse = await fetch(`/api/rooms/${roomId}`);
        const roomData = await roomResponse.json();

        if (roomData.success && roomData.room.host._id === user._id) {
          const hostCode = roomCodes.find(code => code.role === 'host');
          if (hostCode) {
            roomCode = hostCode.code;
            role = 'host';
          }
        }

        if (!roomCode) {
          const listenerCode = roomCodes.find(code => code.role === 'listener');
          if (listenerCode) {
            roomCode = listenerCode.code;
            role = 'listener';
          }
        }

        if (!roomCode) {
          throw new Error('No valid room code found');
        }

        const authToken = await hmsActions.getAuthTokenByRoomCode({
          roomCode: roomCode,
        });

        await hmsActions.join({
          userName: user.username || user.displayName || 'Anonymous',
          authToken,
          metaData: JSON.stringify({
            avatar: user.pfp_url,
            role: role,
            fid: user.fid
          })
        });

        setIsJoining(false);
      } catch (err) {
        console.error('Error joining room:', err);
        setError(err instanceof Error ? err.message : 'Failed to join room');
        setIsJoining(false);
      }
    };

    if (user && roomId) joinRoom();
  }, [roomId, user, hmsActions]);

  useEffect(() => {
    if (isConnected && localPeer) {
      const role = localPeer.roleName;
      if (role === 'host' || role === 'co-host' || role === 'speaker') {
        hmsActions.setLocalAudioEnabled(false);
      }
    }
  }, [isConnected, localPeer, hmsActions]);

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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900">
      <RoleChangeHandler />
      <Header roomId={roomId} />
      <Conference />
      <Footer roomId={roomId} />
    </div>
  );
}
