import { NextRequest, NextResponse } from 'next/server';
import { getCachedAdsState, processAdsWebhookEvent } from '@/utils/serverActions';

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId');
  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  const cached = await getCachedAdsState(roomId);
  return NextResponse.json(cached);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const result = await processAdsWebhookEvent(body, {
    signature: req.headers.get('x-ads-signature') || undefined,
    timestamp: req.headers.get('x-ads-timestamp') || undefined,
    eventType: req.headers.get('x-ads-event') || undefined,
    idempotencyKey: req.headers.get('idempotency-key') || undefined,
  });

  return NextResponse.json(result.body, { status: result.status });
}

