import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';
import { revalidatePath } from 'next/cache';
import { RedisRoomService } from '@/utils/redisServices';

export async function GET(request: NextRequest) {
  try {
    await connectToDB();
    revalidatePath('/');
    
    // Get query params for pagination
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 5; // Limit to 5 rooms per page
    const skip = (page - 1) * limit;
    
    // Get rooms with pagination
    const rooms = await Room.find({ enabled: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('host', 'fid username displayName pfp_url');
    
    // Get participant count for each room
    const roomsWithStrength = await Promise.all(rooms.map(async (room) => {
      const participants = await RedisRoomService.getRoomParticipants(room.id);
      const roomObj = room.toObject();
      return {
        ...roomObj,
        strength: participants.filter(p=>p.status=="active").length
      };
    }));
    
    return NextResponse.json({ 
      success: true, 
      rooms: roomsWithStrength 
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch rooms',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
