import { NextRequest, NextResponse } from 'next/server';
import { getCachedAd } from '@/app/actions/ads';
import { processAdsWebhookEvent } from '@/app/actions/adsWebhook';

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId');
  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  const cached = await getCachedAd(roomId);
  return NextResponse.json(cached);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const result = await processAdsWebhookEvent({
    body,
    signature: req.headers.get('x-ads-signature'),
    timestamp: req.headers.get('x-ads-timestamp'),
    eventType: req.headers.get('x-ads-event'),
    idempotencyKey: req.headers.get('idempotency-key'),
  });
  return NextResponse.json(result.body, { status: result.status });
}

