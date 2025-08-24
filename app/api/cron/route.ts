import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import { sponsorshipService } from '@/utils/sponsorshipService';
import Room from '@/utils/schemas/Room';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDB();

    const results = {
      processedRooms: 0,
      activatedSponsorships: 0,
      completedSponsorships: 0,
      errors: [] as string[]
    };

    try {
      // First, update all expired sponsorships globally
      const completedCount = await sponsorshipService.updateExpiredSponsorships();
      results.completedSponsorships = completedCount;

      // Get all rooms that have sponsorships enabled and are ongoing
      const activeRooms = await Room.find({
        sponsorshipEnabled: true,
        status: 'ongoing'
      }).select('_id');

      // Process queue for each active room
      for (const room of activeRooms) {
        try {
          const activated = await sponsorshipService.processQueue(room._id.toString());
          results.processedRooms++;
          
          if (activated) {
            results.activatedSponsorships++;
          }
        } catch (roomError) {
          console.error(`Error processing room ${room._id}:`, roomError);
          results.errors.push(`Room ${room._id}: ${roomError}`);
        }
      }

    } catch (error) {
      console.error('Error in cron job:', error);
      results.errors.push(`Global error: ${error}`);
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
