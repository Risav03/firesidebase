import { NextRequest, NextResponse } from 'next/server';
import { fetchAPI } from '@/utils/serverActions';

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const fid = req.headers.get('x-user-fid');
  if (!fid) {
    return NextResponse.json({ error: 'Missing x-user-fid header' }, { status: 401 });
  }

  try {
    const res = await fetchAPI(`${backend}/api/ads/protected/rooms/${params.roomId}/stop`, {
      method: 'POST',
      headers: {
        'x-user-fid': fid,
      },
    });
    return NextResponse.json(res.data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to stop ads session' }, { status: 500 });
  }
}

