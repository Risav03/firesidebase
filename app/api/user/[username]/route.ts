import User from '@/utils/schemas/User';
import Room from '@/utils/schemas/Room';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/utils/db';

export async function GET(req: NextRequest, { params }:any) {
    const { username } = params;

    console.log("Fetching data for username:", username);
    await connectToDB()
    // Fetch user by username
    const user = await User.findOne({ username }).select('pfp_url displayName username hostedRooms');
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // Fetch hosted rooms
    const rooms = await Room.find({ host: user._id }).select('roomId name description topics status');
    return NextResponse.json({ user, rooms });
}
