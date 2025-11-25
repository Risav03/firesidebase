import { NextRequest, NextResponse } from 'next/server';
import {
  completeAd,
  getCurrent,
  isDuplicateIdempotency,
  setCurrentAd,
  setSessionRunning,
  stopSession,
} from '@/utils/adsCache';
import { verifyAdsWebhook } from '@/utils/adsWebhook';

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId');
  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  return NextResponse.json(getCurrent(roomId));
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'ADS_WEBHOOK_SECRET is not configured' }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get('x-ads-signature') || undefined;
  const timestamp = req.headers.get('x-ads-timestamp') || undefined;
  const eventType = req.headers.get('x-ads-event') || undefined;
  const idempotencyKey = req.headers.get('idempotency-key') || undefined;

  const isValid = verifyAdsWebhook(signature, timestamp, body, secret);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (isDuplicateIdempotency(idempotencyKey)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    console.error('Failed to parse ads webhook payload', error);
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const roomId = payload?.roomId;
  if (!roomId) {
    return NextResponse.json({ error: 'Missing roomId in payload' }, { status: 400 });
  }

  switch (eventType) {
    case 'ads.session.started':
      setSessionRunning(roomId, payload.sessionId, payload.startedAt);
      break;
    case 'ads.ad.started':
      if (payload.reservationId) {
        setCurrentAd(roomId, {
          reservationId: payload.reservationId,
          adId: payload.adId,
          title: payload.title,
          imageUrl: payload.imageUrl,
          durationSec: payload.durationSec,
          startedAt: payload.startedAt,
          sessionId: payload.sessionId,
        });
      }
      break;
    case 'ads.ad.completed':
      if (payload.reservationId) {
        completeAd(roomId, payload.reservationId);
      }
      break;
    case 'ads.session.stopped':
    case 'ads.session.idle':
      stopSession(roomId);
      break;
    default:
      console.warn('Unhandled ads webhook event', eventType);
      break;
  }

  return NextResponse.json({ ok: true });
}

