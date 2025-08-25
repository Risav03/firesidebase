import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';

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
      deletedRooms: 0,
      checkedRooms: 0,
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
          if (!room.participants || room.participants.length === 0) {
            await Room.findByIdAndDelete(room._id);
            results.deletedRooms++;
            
            console.log(`Deleted room: ${room.name} (ID: ${room._id}) - scheduled for ${room.startTime}, had ${room.participants?.length || 0} participants`);
          } else {
            console.log(`Skipped room: ${room.name} (ID: ${room._id}) - has ${room.participants.length} participants`);
          }
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
      message: `Checked ${results.checkedRooms} old rooms, deleted ${results.deletedRooms} empty rooms`
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
