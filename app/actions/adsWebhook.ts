"use server";

import {
  completeAd,
  getCurrent,
  isDuplicateIdempotency,
  setCurrentAd,
  setSessionRunning,
  stopSession,
} from '@/utils/adsCache';
import { verifyAdsWebhook } from '@/utils/adsWebhook';

const shouldLog = process.env.NODE_ENV !== 'production';

const logAdsWebhook = (message: string, meta?: Record<string, unknown>) => {
  if (!shouldLog) return;
  if (meta) {
    console.log(`[AdsWebhook] ${message}`, meta);
  } else {
    console.log(`[AdsWebhook] ${message}`);
  }
};

type WebhookProcessResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function processAdsWebhookEvent(params: {
  body: string;
  signature?: string | null;
  timestamp?: string | null;
  eventType?: string | null;
  idempotencyKey?: string | null;
}) {
  const secret = process.env.ADS_WEBHOOK_SECRET;
  if (!secret) {
    return {
      status: 500,
      body: { error: 'ADS_WEBHOOK_SECRET is not configured' },
    };
  }

  const { body, signature, timestamp, eventType, idempotencyKey } = params;

  const isValid = verifyAdsWebhook(signature || undefined, timestamp || undefined, body, secret);
  if (!isValid) {
    logAdsWebhook('Invalid webhook signature', { eventType, timestamp });
    return {
      status: 401,
      body: { error: 'Invalid signature' },
    };
  }

  if (isDuplicateIdempotency(idempotencyKey || undefined)) {
    logAdsWebhook('Duplicate webhook skipped', { eventType, idempotencyKey });
    return {
      status: 200,
      body: { ok: true, deduped: true },
    };
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    console.error('Failed to parse ads webhook payload', error);
    return {
      status: 400,
      body: { error: 'Invalid JSON payload' },
    };
  }

  const roomId = payload?.roomId;
  if (!roomId) {
    return {
      status: 400,
      body: { error: 'Missing roomId in payload' },
    };
  }

  logAdsWebhook('Event received', {
    eventType,
    roomId,
    reservationId: payload?.reservationId,
    sessionId: payload?.sessionId,
  });

  switch (eventType) {
    case 'ads.session.started':
      setSessionRunning(roomId, payload.sessionId, payload.startedAt);
      logAdsWebhook('Session marked running', {
        roomId,
        sessionId: payload.sessionId,
      });
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
        logAdsWebhook('Ad cached', {
          roomId,
          reservationId: payload.reservationId,
          adId: payload.adId,
          durationSec: payload.durationSec,
        });
      }
      break;
    case 'ads.ad.completed':
      if (payload.reservationId) {
        completeAd(roomId, payload.reservationId);
        logAdsWebhook('Ad completion processed', {
          roomId,
          reservationId: payload.reservationId,
        });
      }
      break;
    case 'ads.session.stopped':
    case 'ads.session.idle':
      stopSession(roomId);
      logAdsWebhook('Session stopped', {
        roomId,
        sessionId: payload.sessionId,
        reason: eventType === 'ads.session.idle' ? payload?.reason || 'idle' : 'stopped',
      });
      break;
    default:
      console.warn('Unhandled ads webhook event', eventType);
      logAdsWebhook('Unhandled event', { eventType, roomId });
      break;
  }

  return {
    status: 200,
    body: { ok: true },
  };
}

export async function getCachedAdState(roomId: string) {
  return getCurrent(roomId);
}

