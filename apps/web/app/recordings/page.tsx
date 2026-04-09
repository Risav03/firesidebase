import { fetchAPI } from "@/utils/serverActions";
import RecordingsList from "@/components/Recordings";

interface Room {
  _id: string;
  roomId: string;
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
import NavigationWrapper from "@/components/NavigationWrapper";
import MainHeader from "@/components/UI/MainHeader";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Server-side function to fetch rooms
async function fetchRooms(): Promise<Room[]> {
    try {
      const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetchAPI(`${URL}/api/rooms/public/recorded`, {
        cache: 'no-store',
      });
      
      if (response.ok && response.data.success) {
        return response.data.data.rooms;
      }
      return [];
    } catch (error) {
      console.error("Error fetching rooms:", error);
      return [];
    }
  }

export default async function Recordings() {

  const rooms = await fetchRooms();

  return (
    <div>
      <MainHeader/>
      <RecordingsList rooms={rooms || []} />
      <NavigationWrapper />
    </div>
  );
}