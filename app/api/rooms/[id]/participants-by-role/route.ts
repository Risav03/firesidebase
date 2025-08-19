import { NextRequest, NextResponse } from 'next/server';
import { RedisRoomService } from '@/utils/redisServices';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const participantsByRole = activeOnly 
      ? await RedisRoomService.getActiveRoomParticipantsByRole(params.id)
      : await RedisRoomService.getRoomParticipantsByRole(params.id);

    return NextResponse.json({
      success: true,
      participantsByRole,
      totalParticipants: Object.values(participantsByRole).reduce((sum, roleUsers) => sum + roleUsers.length, 0),
      activeOnly
    });

  } catch (error) {
    console.error('Error fetching participants by role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch participants by role' },
      { status: 500 }
    );
  }
}

// Get participants for a specific role
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { role } = body;

    if (!role || !['host', 'co-host', 'speaker', 'listener'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be: host, co-host, speaker, or listener' },
        { status: 400 }
      );
    }

    const participants = await RedisRoomService.getParticipantsByRole(params.id, role);

    return NextResponse.json({
      success: true,
      role,
      participants,
      count: participants.length
    });

  } catch (error) {
    console.error('Error fetching participants for role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch participants for role' },
      { status: 500 }
    );
  }
}
