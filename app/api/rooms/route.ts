import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Room from '@/utils/schemas/Room';
import { revalidatePath } from 'next/cache';

export async function GET(request: NextRequest) {
  try {
    await connectToDB();
    revalidatePath('/');
    
    const rooms = await Room.find({ enabled: true })
      .sort({ createdAt: -1 });
    
    
    return NextResponse.json({ 
      success: true, 
      rooms 
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch rooms',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
