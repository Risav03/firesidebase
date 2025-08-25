import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';
import Sponsorship from '@/utils/schemas/Sponsorship';
import Room from '@/utils/schemas/Room';
import User from '@/utils/schemas/User';

export async function GET(request: NextRequest) {
  try {
    await connectToDB();
    
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const sponsorId = searchParams.get('sponsorId');
    const status = searchParams.get('status');
    const hostId = searchParams.get('hostId');
    
    let query: any = {};
    
    if (roomId) query.roomId = roomId;
    if (sponsorId) query.sponsorId = sponsorId;
    if (status) query.status = status;
    
    // If hostId is provided, find sponsorships for rooms hosted by this user
    if (hostId) {
      const hostedRooms = await Room.find({ host: hostId }).select('_id');
      const hostedRoomIds = hostedRooms.map(room => room._id);
      query.roomId = { $in: hostedRoomIds };
    }
    
    const sponsorships = await Sponsorship.find(query)
      .populate('roomId', 'name host status sponsorshipEnabled')
      .populate('sponsorId', 'fid username displayName pfp_url')
      .sort({ requestedAt: -1 });
    
    return NextResponse.json({
      success: true,
      sponsorships
    });
  } catch (error) {
    console.error('Error fetching sponsorships:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sponsorships',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDB();
    
    const body = await request.json();
    const { roomId, sponsorId, bannerUrl, displayDuration, price } = body;
    
    if (!roomId || !sponsorId || !bannerUrl || !displayDuration || !price) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: roomId, sponsorId, bannerUrl, displayDuration, price' },
        { status: 400 }
      );
    }
    
    const room = await Room.findById(roomId);
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }
    
    if (!room.sponsorshipEnabled) {
      return NextResponse.json(
        { success: false, error: 'Sponsorships are not enabled for this room' },
        { status: 400 }
      );
    }
    
    const sponsor = await User.findById(sponsorId);
    if (!sponsor) {
      return NextResponse.json(
        { success: false, error: 'Sponsor not found' },
        { status: 404 }
      );
    }
    
    const sponsorship = new Sponsorship({
      roomId,
      sponsorId,
      bannerUrl,
      displayDuration,
      price,
      status: 'pending'
    });
    
    await sponsorship.save();
    
    await sponsorship.populate('roomId', 'name host status sponsorshipEnabled');
    await sponsorship.populate('sponsorId', 'fid username displayName pfp_url');
    
    return NextResponse.json({
      success: true,
      sponsorship,
      message: 'Sponsorship request created successfully'
    });
    
  } catch (error) {
    console.error('Error creating sponsorship:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create sponsorship request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
