import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';
import { RedisRoomService, RedisChatService } from '@/utils/redisServices';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDB();

    const results = {
      checkedRooms: 0,
      cleanedRedisEntries: 0,
      errors: [] as string[]
    };

    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const oldRooms = await Room.find({
        startTime: { $lt: twentyFourHoursAgo },
        status: { $ne: 'ongoing' }
      });

      results.checkedRooms = oldRooms.length;

      for (const room of oldRooms) {
        try {
          await RedisRoomService.deleteRoomParticipants(room._id.toString());
          await RedisChatService.deleteRoomMessages(room._id.toString());
          results.cleanedRedisEntries++;
          
          console.log(`Cleaned Redis data for room: ${room.name} (ID: ${room._id}) - scheduled for ${room.startTime}`);
        } catch (roomError) {
          console.error(`Error processing room ${room._id}:`, roomError);
          results.errors.push(`Room ${room._id}: ${roomError}`);
        }
      }

    } catch (error) {
      console.error('Error in cleanup cron job:', error);
      results.errors.push(`Global error: ${error}`);
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
      message: `Processed ${results.checkedRooms} old rooms and cleaned ${results.cleanedRedisEntries} Redis entries. Room details preserved in database.`
    });

  } catch (error) {
    console.error('Room cleanup cron job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Room cleanup cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
