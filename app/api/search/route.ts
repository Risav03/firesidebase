import { NextRequest, NextResponse } from 'next/server';
import User from '@/utils/schemas/User';
import Room from '@/utils/schemas/Room';
import { connectToDB } from '@/utils/db';

export async function GET(request: NextRequest) {
  try {
    await connectToDB();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    if (!query) {
      return NextResponse.json({ success: false, error: 'Missing search query' }, { status: 400 });
    }

    // User search by username or displayName (case-insensitive, partial match)
    const userResults = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } }
      ]
    }).select('fid username displayName pfp_url');

    // Room search by name or tags (topics)
    const roomResults = await Room.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { topics: { $regex: query, $options: 'i' } }
      ]
    }).select('roomId name description topics host');

    return NextResponse.json({
      success: true,
      users: userResults,
      rooms: roomResults
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
  }
}
