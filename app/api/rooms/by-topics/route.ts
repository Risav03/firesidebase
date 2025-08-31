import { NextRequest, NextResponse } from 'next/server';
import Room from '@/utils/schemas/Room';
import { connectToDB } from '@/utils/db';

export async function POST(req: NextRequest) {
  try {
    await connectToDB();
    const body = await req.json();
    const { topics } = body;
    if (!Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ success: false, error: 'No topics provided' }, { status: 400 });
    }
    // Find rooms that have at least one of the user's topics
    const rooms = await Room.find({ topics: { $in: topics } })
      .select('name description host status startTime endTime topics roomId enabled')
      .populate('host', 'fid username displayName pfp_url');
    return NextResponse.json({ success: true, rooms });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
