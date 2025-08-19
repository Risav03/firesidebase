import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';
import User from '@/utils/schemas/User';
import { HMSAPI } from '@/utils/100ms';
import { RedisRoomService } from '@/utils/redisServices';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, host, startTime } = body;
    await connectToDB();

    const hostUser = await User.findOne({ fid: host });

    // Validate required fields
    if (!name || !host || !startTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, host, startTime' },
        { status: 400 }
      );
    }

    await connectToDB();

    // Create room in 100ms
    const hmsAPI = new HMSAPI();
    const hmsRoom = await hmsAPI.createRoom(name, description);

    await hmsAPI.generateRoomCodes(hmsRoom.id);

    const currentTime = new Date();

    // Create room in our database
    const room = new Room({
      name,
      description,
      host: hostUser._id,
      startTime: new Date(startTime),
      roomId: hmsRoom.id,
      participants: [hostUser._id],
      status: currentTime < new Date(startTime) ? 'upcoming' : 'ongoing',
    });

    await room.save();

    // Populate host and participants for response
    await room.populate('host', 'fid username displayName pfp_url');

    // Add host as participant in Redis
    try {
      const roomId = room._id.toString();
      await RedisRoomService.addParticipant(roomId, hostUser, 'host');
      console.log('Host added to Redis participants successfully');
    } catch (redisError) {
      console.error('Failed to add host to Redis:', redisError);
    }

    return NextResponse.json({
      success: true,
      room,
      message: 'Room created successfully'
    });

  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create room' },
      { status: 500 }
    );
  }
}
