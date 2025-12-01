"use server";

import sdk from '@farcaster/miniapp-sdk';
import { fetchAPI } from '@/utils/serverActions';
import { getCurrent } from '@/utils/adsCache';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const BASE_URL = process.env.NEXT_PUBLIC_URL;
const ENV = process.env.NEXT_PUBLIC_ENV;

function ensureBackendUrl() {
  if (!BACKEND_URL) {
    throw new Error('Backend URL is not configured');
  }
}

function ensureBaseUrl() {
  if (!BASE_URL) {
    throw new Error('NEXT_PUBLIC_URL is not set');
  }
}

function requireAuthHeader(authHeader?: string | null) {
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  return authHeader;
}

async function resolveSessionAuthHeader(authHeader?: string | null) {
  if (authHeader) return authHeader;
  if (ENV === 'DEV') {
    return 'Bearer dev';
  }
  try {
    const tokenResponse = await sdk.quickAuth.getToken();
    if (tokenResponse?.token) {
      return `Bearer ${tokenResponse.token}`;
    }
  } catch (error) {
    console.warn('Failed to resolve ads session auth header', error);
  }
  return null;
}

export async function startAdsSession(roomId: string, authHeader?: string | null) {
  ensureBackendUrl();
  ensureBaseUrl();
  const header = requireAuthHeader(authHeader);
  const res = await fetchAPI(`${BACKEND_URL}/api/ads/protected/rooms/${roomId}/start`, {
    method: 'POST',
    body: { webhookUrl: `${BASE_URL}/api/webhooks/ads` },
    headers: {
      Authorization: header,
    },
  });
  if (!res.ok) {
    throw new Error(res.data?.error || 'Failed to start ads session');
  }
  return res.data;
}

export async function stopAdsSession(roomId: string, authHeader?: string | null) {
  ensureBackendUrl();
  const header = requireAuthHeader(authHeader);
  const res = await fetchAPI(`${BACKEND_URL}/api/ads/protected/rooms/${roomId}/stop`, {
    method: 'POST',
    headers: {
      Authorization: header,
    },
  });
  if (!res.ok) {
    throw new Error(res.data?.error || 'Failed to stop ads session');
  }
  return res.data;
}

export async function notifyAdsRoomEnded(roomId: string, authHeader?: string | null) {
  ensureBackendUrl();
  const header = requireAuthHeader(authHeader);
  const res = await fetchAPI(`${BACKEND_URL}/api/ads/protected/rooms/${roomId}/room-ended`, {
    method: 'POST',
    headers: {
      Authorization: header,
    },
  });
  if (!res.ok) {
    throw new Error(res.data?.error || 'Failed to notify ads room-ended');
  }
  return res.data;
}

export async function fetchAdsSession(roomId: string, authHeader?: string | null) {
  ensureBackendUrl();
  const header = await resolveSessionAuthHeader(authHeader);
  const headers: Record<string, string> = header ? { Authorization: header } : {};
  const res = await fetchAPI(`${BACKEND_URL}/api/ads/protected/sessions/${roomId}`, {
    cache: 'no-store',
    headers,
  });
  if (!res.ok) {
    throw new Error(res.data?.error || 'Failed to fetch ads session');
  }
  return res.data;
}

export async function getCachedAd(roomId: string) {
  return getCurrent(roomId);
}

