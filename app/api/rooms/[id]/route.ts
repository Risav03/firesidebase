import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    await connectToDB();
    
    const room = await Room.findById(id)
      .populate('host', 'fid username displayName pfp_url')
      .populate('participants', 'fid username displayName pfp_url');
    
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      room 
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}
