import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';
import { HMSAPI } from '@/utils/100ms';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    await connectToDB();
    
    const room = await Room.findById(id);
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }
    
    // Get room codes from 100ms
    const hmsAPI = new HMSAPI();
    const roomCodes = await hmsAPI.getRoomCodes(room.roomId);
    
    return NextResponse.json({ 
      success: true, 
      roomCodes: roomCodes.data 
    });
  } catch (error) {
    console.error('Error fetching room codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch room codes' },
      { status: 500 }
    );
  }
}
