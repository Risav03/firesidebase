import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import User from '@/utils/schemas/User';
import { RedisRoomService } from '@/utils/redisServices';

// POST - Add user as participant when they join a room
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { userFid, role = 'listener' } = body;

    if (!userFid) {
      return NextResponse.json(
        { success: false, error: 'userFid is required' },
        { status: 400 }
      );
    }

    await connectToDB();
    
    // Get user data
    const user = await User.findOne({ fid: userFid });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already a participant to avoid duplicates
    const participants = await RedisRoomService.getRoomParticipants(params.id);
    const existingParticipant = participants.find(p => p.userId === userFid);
    
    if (existingParticipant) {
      return NextResponse.json({
        success: true,
        message: 'User already a participant',
        participant: existingParticipant
      });
    }

    // Add participant to room with listener role by default
    await RedisRoomService.addParticipant(params.id, user, role as any);

    return NextResponse.json({
      success: true,
      message: 'Participant joined successfully',
      participant: {
        userId: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfp_url: user.pfp_url,
        role: role,
        joinedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error adding participant on join:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add participant' },
      { status: 500 }
    );
  }
}
