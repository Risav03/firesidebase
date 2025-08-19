import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import User from '@/utils/schemas/User';
import { RedisRoomService } from '@/utils/redisServices';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const participants = await RedisRoomService.getRoomParticipants(params.id);

    return NextResponse.json({
      success: true,
      participants
    });

  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch participants' },
      { status: 500 }
    );
  }
}

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

    const validRoles = ['host', 'co-host', 'speaker', 'listener'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    await connectToDB();
    
    const user = await User.findOne({ fid: userFid });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    await RedisRoomService.addParticipant(params.id, user, role);

    return NextResponse.json({
      success: true,
      message: 'Participant added successfully'
    });

  } catch (error) {
    console.error('Error adding participant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add participant' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { userFid, newRole } = body;

    if (!userFid || !newRole) {
      return NextResponse.json(
        { success: false, error: 'userFid and newRole are required' },
        { status: 400 }
      );
    }

    const validRoles = ['host', 'co-host', 'speaker', 'listener'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    await RedisRoomService.updateParticipantRole(params.id, userFid, newRole);

    return NextResponse.json({
      success: true,
      message: 'Participant role updated successfully'
    });

  } catch (error) {
    console.error('Error updating participant role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update participant role' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('userFid');

    if (!userFid) {
      return NextResponse.json(
        { success: false, error: 'userFid parameter is required' },
        { status: 400 }
      );
    }

    await RedisRoomService.removeParticipant(params.id, userFid);

    return NextResponse.json({
      success: true,
      message: 'Participant removed successfully'
    });

  } catch (error) {
    console.error('Error removing participant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove participant' },
      { status: 500 }
    );
  }
}
