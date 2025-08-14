import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, endTime, participants, action } = body;
    
    await connectToDB();
    
    const room = await Room.findById(id);
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }
    
    // Update status if provided
    if (status && ['upcoming', 'ongoing', 'ended'].includes(status)) {
      room.status = status;
    }
    
    // Update end time if provided
    if (endTime) {
      room.endTime = new Date(endTime);
    }
    
    // Handle participant management
    if (participants && action) {
      if (action === 'add') {
        // Add participants (avoid duplicates)
        participants.forEach((participantId: string) => {
          if (!room.participants.includes(participantId)) {
            room.participants.push(participantId);
          }
        });
      } else if (action === 'remove') {
        // Remove participants
        room.participants = room.participants.filter(
          (participantId: string) => !participants.includes(participantId)
        );
      }
    }
    
    await room.save();
    
    // Populate for response
    await room.populate('host', 'fid username displayName pfp_url');
    await room.populate('participants', 'fid username displayName pfp_url');
    
    return NextResponse.json({
      success: true,
      room,
      message: 'Room updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update room' },
      { status: 500 }
    );
  }
}
