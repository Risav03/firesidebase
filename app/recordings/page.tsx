'use server'

import { fetchAPI } from "@/utils/serverActions";
import { Room } from "../page";
import RecordingsList from "@/components/Recordings";
import NavigationWrapper from "@/components/NavigationWrapper";
import MainHeader from "@/components/UI/MainHeader";

// Server-side function to fetch rooms
async function fetchRooms(): Promise<Room[]> {
    try {
      const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetchAPI(`${URL}/api/rooms/public`, { 
        cache: 'no-store' 
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
  return (
    <div>
      <MainHeader/>
      <RecordingsList rooms={await fetchRooms()} />
      <NavigationWrapper />
    </div>
  );
}