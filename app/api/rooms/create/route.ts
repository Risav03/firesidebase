import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';
import User from '@/utils/schemas/User';
import { HMSAPI } from '@/utils/100ms';
import { RedisRoomService } from '@/utils/redisServices';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, host, startTime, topics } = body;
    await connectToDB();

    const hostUser = await User.findOne({ fid: host });

    // Validate required fields
      if (!name || !host || !startTime || !topics || !Array.isArray(topics) || topics.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields: name, host, startTime, topics' },
          { status: 400 }
        );
      }

    await connectToDB();

    // Generate a random hash (6 characters) to append to the HMS room name
    const randomHash = crypto.randomBytes(3).toString('hex');
    const hmsRoomName = `${name}_${randomHash}`;

    // Create room in 100ms with the modified name
    const hmsAPI = new HMSAPI();
    let hmsRoom;
    try {
      hmsRoom = await hmsAPI.createRoom(hmsRoomName, description);
    } catch (error) {
      console.error('Error creating room in 100ms:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create room in 100ms service' },
        { status: 500 }
      );
    }

    // Generate room codes
    try {
      await hmsAPI.generateRoomCodes(hmsRoom.id);
    } catch (error) {
      console.error('Error generating room codes:', error);
      // Continue with room creation even if code generation fails
    }

    const currentTime = new Date();

    // Create room in our database with original name (including symbols)
    const room = new Room({
      name, // Keep the original name with symbols in our database
      description,
      host: hostUser._id,
      startTime: new Date(startTime),
      roomId: hmsRoom.id,
      participants: [hostUser._id],
      status: currentTime < new Date(startTime) ? 'upcoming' : 'ongoing',
      topics,
    });

    await room.save();

    // Add room to host's hostedRooms
    hostUser.hostedRooms = hostUser.hostedRooms || [];
    hostUser.hostedRooms.push(room._id);
    await hostUser.save();

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