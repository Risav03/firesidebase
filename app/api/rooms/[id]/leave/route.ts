import { NextRequest, NextResponse } from 'next/server';
import { RedisRoomService } from '@/utils/redisServices';

// POST - Remove user as participant when they leave a room
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { userFid } = body;

    if (!userFid) {
      return NextResponse.json(
        { success: false, error: 'userFid is required' },
        { status: 400 }
      );
    }

    // Mark participant as inactive instead of removing them
    await RedisRoomService.updateParticipantStatus(params.id, userFid, 'inactive');
    return NextResponse.json({
      success: true,
      message: 'Participant left successfully'
    });

  } catch (error) {
    console.error('Error removing participant on leave:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove participant' },
      { status: 500 }
    );
  }
}
