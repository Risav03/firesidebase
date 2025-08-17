import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await request.json();
    const roomId = params.id;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDB();

    // Find the room and check if user is host
    const room = await Room.findById(roomId);
    
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 400 }
      );
    }

    // Check if user is the host of this room
    if (room.host.toString() !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the host can end the room' },
        { status: 403 }
      );
    }

    // End room in 100ms using the end-room endpoint
    try {
      const hmsResponse = await fetch(`https://api.100ms.live/v2/active-rooms/${room.roomId}/end-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.HUNDRED_MS_MANAGEMENT_TOKEN}`,
        },
        body: JSON.stringify({
          reason: "The session has ended",
          lock: true
        }),
      });

      if (!hmsResponse.ok) {
        console.error('Failed to end room in 100ms:', await hmsResponse.text());
        // Continue with database update even if 100ms fails
      } else {
        console.log('Room successfully ended in 100ms');
      }
    } catch (hmsError) {
      console.error('Error ending room in 100ms:', hmsError);
      // Continue with database update even if 100ms fails
    }

    // Update room status to disabled in our database
    const updatedRoom = await Room.findByIdAndUpdate(
      roomId,
      { 
        enabled: false,
        ended_at: new Date(),
        status: 'ended'
      },
      { new: true }
    );

    if (!updatedRoom) {
      return NextResponse.json(
        { success: false, error: 'Failed to update room' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Room ended successfully',
      room: updatedRoom
    });

  } catch (error) {
    console.error('Error ending room:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
