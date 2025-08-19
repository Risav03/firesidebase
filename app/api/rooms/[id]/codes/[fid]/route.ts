import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';
import User from '@/utils/schemas/User';
import { HMSAPI } from '@/utils/100ms';
import { RedisRoomService } from '@/utils/redisServices';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; fid: string } }
) {
  try {
    const { id: roomId, fid } = params;
    
    await connectToDB();
    
    const room = await Room.findById(roomId).populate('host', 'fid');
    const user = await User.findOne({ fid: fid });
    
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    let role = 'listener';
    
    if (room.host && room.host.fid === fid) {
      role = 'host';
    }else{
      const existingParticipant = await RedisRoomService.getParticipant(roomId, fid);
      if (existingParticipant) {
        role = existingParticipant.role;
      }
    }

    
    const hmsAPI = new HMSAPI();
    const roomCodes = await hmsAPI.getRoomCodes(room.roomId);
    
    const userCode = roomCodes.data.find(code => code.role === role);
    
    if (!userCode) {
      return NextResponse.json(
        { success: false, error: `No room code found for role: ${role}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      role: role,
      code: userCode.code,
      roomCode: userCode
    });
    
  } catch (error) {
    console.error('Error fetching user room code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user room code' },
      { status: 500 }
    );
  }
}