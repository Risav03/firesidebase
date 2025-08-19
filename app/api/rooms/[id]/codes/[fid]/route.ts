import { NextRequest, NextResponse } from 'next/server';
import { RedisRoomService } from '@/utils/redisServices';

export async function GET(request: NextRequest, { params }: { params: { id: string; fid: string } }) {
  const { id: roomId, fid } = params;

  console.log('Fetching participant for roomId:', roomId, 'and fid:', fid);

  try {
    const participant = await RedisRoomService.getParticipant(String(roomId), String(fid));

    console.log('Fetched participant:', participant);

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    return NextResponse.json(participant);
  } catch (error) {
    console.error('Error fetching participant:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}