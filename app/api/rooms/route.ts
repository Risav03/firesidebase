import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';

export async function GET(request: NextRequest) {
  try {
    await connectToDB();
    
    const rooms = await Room.find({ enabled: true })
      .populate('host', 'fid username displayName pfp_url')
      .populate('participants', 'fid username displayName pfp_url')
      .sort({ createdAt: -1 });
    
    return NextResponse.json({ 
      success: true, 
      rooms 
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}
