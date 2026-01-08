import { NextRequest, NextResponse } from 'next/server';
import { fetchAPI } from '@/utils/serverActions';
import sdk from "@farcaster/miniapp-sdk";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  try {
    let authHeader = 'Bearer dev';
    const env = process.env.NEXT_PUBLIC_ENV;
    if (env !== 'DEV') {
      const tokenResponse = await sdk.quickAuth.getToken();
      authHeader = `Bearer ${tokenResponse.token}`;
    };
    const res = await fetchAPI(`${URL}/api/ads/protected/sessions/${params.roomId}`, {
      cache: 'no-store',
      headers: {
        Authorization: authHeader,
      },
    });
    return NextResponse.json(res.data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}


