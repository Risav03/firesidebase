import { NextRequest, NextResponse } from 'next/server';
import { verifyAdsWebhook } from '@/utils/adsWebhook';
import { completeAd, getCurrent, isDuplicateIdempotency, setCurrentAd, setSessionRunning, stopSession, hasAdBeenShown, markAdShown } from '@/utils/adsCache';
import { fetchAPI } from '@/utils/serverActions';

export async function POST(req: NextRequest) {
  const event = req.headers.get('X-Ads-Event') || req.headers.get('x-ads-event') || '';
  const timestamp = req.headers.get('X-Ads-Timestamp') || req.headers.get('x-ads-timestamp') || '';
  const signature = req.headers.get('X-Ads-Signature') || req.headers.get('x-ads-signature') || '';
  const idempotencyKey = req.headers.get('Idempotency-Key') || req.headers.get('idempotency-key') || undefined;

  const rawBody = await req.text();

  const secret = process.env.ADS_WEBHOOK_SECRET || '';
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!verifyAdsWebhook(signature, timestamp, rawBody, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (isDuplicateIdempotency(idempotencyKey)) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    const payload = JSON.parse(rawBody);

    switch (event) {
      case 'ads.session.started': {
        const { roomId, sessionId, startedAt } = payload;
        setSessionRunning(roomId, sessionId, startedAt);
        break;
      }
      case 'ads.ad.started': {
        const { roomId, sessionId, reservationId, adId, title, imageUrl, durationSec, startedAt } = payload;
        // Do not show the same ad twice in the same room (check only; we mark as shown on completed)
        if (hasAdBeenShown(roomId, adId)) {
          break;
        }
        setCurrentAd(roomId, { reservationId, adId, title, imageUrl, durationSec, startedAt, sessionId });
        break;
      }
      case 'ads.ad.completed': {
        const { roomId, reservationId, adId } = payload;
        if (adId) {
          markAdShown(roomId, adId);
        }
        completeAd(roomId, reservationId);
        break;
      }
      case 'ads.session.stopped': {
        const { roomId } = payload;
        stopSession(roomId);
        break;
      }
      case 'ads.session.idle': {
        const { roomId } = payload;
        stopSession(roomId);
        // Best-effort: request backend to stop to avoid flickering when no inventory
        try {
          const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
          await fetchAPI(`${backend}/api/ads/protected/rooms/${roomId}/stop`, { method: 'POST' });
        } catch {}
        break;
      }
      default: {
        // ignore unknown events
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  // Optional: allow quick read for debugging with ?roomId=XYZ
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId');
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  return NextResponse.json(getCurrent(roomId));
}


