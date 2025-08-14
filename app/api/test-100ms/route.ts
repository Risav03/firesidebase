import { NextRequest, NextResponse } from 'next/server';
import { HMSAPI } from '@/utils/100ms';

export async function GET(request: NextRequest) {
  try {
    const hmsAPI = new HMSAPI();
    
    // Test the connection by trying to list rooms (this should work with a valid token)
    const response = await fetch('https://api.100ms.live/v2/rooms', {
      headers: {
        'Authorization': `Bearer ${process.env.HUNDRED_MS_MANAGEMENT_TOKEN}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: '100ms API connection failed',
        status: response.status,
        details: errorText
      });
    }
    
    const rooms = await response.json();
    
    return NextResponse.json({
      success: true,
      message: '100ms API connection successful',
      roomsCount: rooms.data?.length || 0
    });
    
  } catch (error) {
    console.error('100ms test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '100ms test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
