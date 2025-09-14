import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';
import User from '@/utils/schemas/User';
import { RedisRoomService } from '@/utils/redisServices';
import mongoose from 'mongoose';

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
    // if (room.host.toString() !== userId) {
    //   return NextResponse.json(
    //     { success: false, error: 'Only the host can end the room' },
    //     { status: 403 }
    //   );
    // }

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

    // Get all participants from Redis by role
    const roles = ['host', 'co-host', 'speaker', 'listener'];
    const allParticipantIds = new Set<mongoose.Types.ObjectId>();
    
    // Keep track of participants by role
    const participantsByRole: {
      host: mongoose.Types.ObjectId[];
      'co-host': mongoose.Types.ObjectId[];
      speaker: mongoose.Types.ObjectId[];
      listener: mongoose.Types.ObjectId[];
    } = {
      host: [],
      'co-host': [],
      speaker: [],
      listener: []
    };
    
    // Collect participant IDs from all roles
    for (const role of roles) {
      try {
        const participants = await RedisRoomService.getParticipantsByRole(params.id, role as any);
        for (const participant of participants) {
          if (participant.dbId) {
            // Add to overall participant set
            allParticipantIds.add(participant.dbId);
            
            // Add to role-specific array
            participantsByRole[role as keyof typeof participantsByRole].push(participant.dbId);
          }
        }
      } catch (error) {
        console.error(`Error fetching ${role} participants:`, error);
      }
    }
    
    // Convert Set to Array for database update
    const participantIdArray = Array.from(allParticipantIds);
    
    // Update room status to disabled in our database and add participants
    const updatedRoom = await Room.findByIdAndUpdate(
      roomId,
      { 
        enabled: false,
        ended_at: new Date(),
        status: 'ended',
        participants: participantIdArray
      },
      { new: true }
    );

    if (!updatedRoom) {
      return NextResponse.json(
        { success: false, error: 'Failed to update room' },
        { status: 500 }
      );
    }
    
    // Update all users' role-specific participation fields
    if (participantIdArray.length > 0) {
      try {
        // Update role-specific participation
        if (participantsByRole['co-host'].length > 0) {
          await User.updateMany(
            { _id: { $in: participantsByRole['co-host'] } },
            { $addToSet: { coHostedRooms: roomId } }
          );
        }
        
        if (participantsByRole.speaker.length > 0) {
          await User.updateMany(
            { _id: { $in: participantsByRole.speaker } },
            { $addToSet: { speakerRooms: roomId } }
          );
        }
        
        if (participantsByRole.listener.length > 0) {
          await User.updateMany(
            { _id: { $in: participantsByRole.listener } },
            { $addToSet: { listenerRooms: roomId } }
          );
        }
        
        // Note: We don't update hostedRooms here because that's typically handled when creating a room
        
        console.log(`Updated role-specific room lists for ${participantIdArray.length} users`);
        console.log(`Role breakdown - Co-hosts: ${participantsByRole['co-host'].length}, Speakers: ${participantsByRole.speaker.length}, Listeners: ${participantsByRole.listener.length}`);
      } catch (updateError) {
        console.error('Error updating user room participation:', updateError);
        // Continue with response even if user updates fail
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Room ended successfully',
      room: updatedRoom,
      participantCount: participantIdArray.length,
      roleBreakdown: {
        hosts: participantsByRole.host.length,
        coHosts: participantsByRole['co-host'].length,
        speakers: participantsByRole.speaker.length,
        listeners: participantsByRole.listener.length
      }
    });

  } catch (error) {
    console.error('Error ending room:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
