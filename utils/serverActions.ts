'use server'

import sdk from "@farcaster/miniapp-sdk";
import { parseWebhookEvent, verifyAppKeyWithNeynar } from "@farcaster/miniapp-node";
import {
  completeAd,
  getCurrent,
  isDuplicateIdempotency,
  setCurrentAd,
  setSessionRunning,
  stopSession,
} from "@/utils/adsCache";
import { verifyAdsWebhook } from "@/utils/adsWebhook";

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  authToken?: string | null;
  cache?: RequestCache;
};

/**
 * Single server action for making API requests from the server side
 * 
 * This ensures all API calls originate from Vercel servers, not the client
 * 
 * @param url - The URL to fetch from
 * @param options - Request options (method, body, headers, authToken, cache)
 * @returns Response object with data, status and ok flag
 */
export async function fetchAPI(url: string, options: FetchOptions = {}) {
  try {
    console.log(`Server fetch to: ${url} with options:`, options);
    const {
      method = 'GET',
      body,
      headers = {},
      authToken,
      cache
    } = options;

    // Set up headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    // Add auth header if provided
    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    // Create request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      cache,
    };

    // Add body for non-GET requests
    if (method !== 'GET' && body !== undefined) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Make the request
    const response = await fetch(url, requestOptions);
    
    // Parse response
    const data = await response.json();

    console.log("response", data);    
    
    // Return formatted response
    return {
      data,
      status: response.status,
      ok: response.ok
    };
  } catch (error) {
    console.error(`Server fetch error for ${url}:`, error);
    throw error;
  }
}

// Client-callable server actions for specific components

/**
 * Fetch user profile rooms (for profile page)
 */
export async function fetchUserRooms(username: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/public/username/${username}`);
}

/**
 * Fetch user profile by FID (for ViewProfileModal)
 */
export async function fetchUserByFid(fid: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/public/${fid}`);
}

/**
 * Update user profile (for profile page)
 */
export async function refreshUserProfile(token: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/protected/update?query=profile`, {
    method: 'PATCH',
    authToken: token
  });
}

/**
 * Update user notification token
 */
export async function updateUserNotificationToken(notificationToken: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  console.log("Updating user notification token:", notificationToken);
  return fetchAPI(`${URL}/api/users/protected/update`, {
    method: 'PATCH',
    body: { token: notificationToken },
    authToken: token
  });
}

/**
 * Fetch room recordings (for recordings page)
 */
export async function fetchRoomRecordings(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/recordings`);
}

/**
 * Fetch room codes (for CallClient)
 */
export async function fetchRoomCodes(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/codes`);
}

/**
 * Add participant to room
 */
export async function addParticipantToRoom(roomId: string, userData: any, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/join`, {
    method: 'POST',
    body: userData,
    authToken: token
  });
}

/**
 * Remove participant from room
 */
export async function removeParticipantFromRoom(roomId: string, userData: any, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/leave`, {
    method: 'POST',
    body: userData,
    authToken: token
  });
}

/**
 * Fetch chat messages for a room
 */
export async function fetchChatMessages(roomId: string, limit: number = 50) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/messages?limit=${limit}`);
}

/**
 * Send a chat message to a room
 */
export async function sendChatMessage(roomId: string, messageData: any, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/messages`, {
    method: 'POST',
    body: messageData,
    authToken: token
  });
}

/**
 * Fetch room details by room ID
 */
export async function fetchRoomDetails(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}`);
}

/**
 * End a room session
 */
export async function endRoom(roomId: string, userId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/${roomId}/end`, {
    method: 'POST',
    body: { userId }
  });
}

/**
 * Update user topics
 */
export async function updateUserTopics(topics: string[], token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/protected/topics`, {
    method: 'PATCH',
    body: { topics },
    authToken: token
  });
}

/**
 * Fetch user profile by handle
 */
export async function fetchUserByHandle(token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/users/protected/handle`, {
    method: 'POST',
    authToken: token
  });
}

/**
 * Fetch rooms by topics
 */
export async function fetchRoomsByTopics(topics: string[]) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/by-topics`, {
    method: 'POST',
    body: { topics }
  });
}

/**
 * Fetch all public rooms
 */
export async function fetchAllRooms() {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/`);
}

/**
 * End a protected room session
 */
export async function endProtectedRoom(roomId: string, userId: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/end`, {
    method: 'POST',
    body: { userId },
    authToken: token
  });
}

/**
 * Fetch room participants
 */
export async function fetchRoomParticipants(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants`);
}

export async function fetchLiveParticipants(roomId: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants-live`);
}

/**
 * Fetch room participants by role
 */
export async function fetchRoomParticipantsByRole(roomId: string, role: string, activeOnly: boolean = true) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/public/${roomId}/participants?role=${role}&activeOnly=${activeOnly}`);
}

/**
 * Update room participant role
 */
export async function updateParticipantRole(roomId: string, userFid: string, newRole: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}/participants`, {
    method: 'PUT',
    body: {
      userFid,
      newRole
    },
    authToken: token
  });
}

/**
 * Transfer host role
 */
export async function transferHostRole(roomId: string, userFid: string, newRole: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/${roomId}/participants`, {
    method: 'PUT',
    body: {
      userFid,
      newRole
    }
  });
}

/**
 * Search for users and rooms
 */
export async function searchUsersAndRooms(query: string) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/search?q=${encodeURIComponent(query.trim())}`);
}

/**
 * Create a new room
 */
export async function createRoom(roomData: {
  name: string;
  description: string;
  host: string;
  startTime: string;
  topics: string[];
}, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected`, {
    method: 'POST',
    body: roomData,
    authToken: token
  });
}

/**
 * Create a sponsorship for a room
 */
// Sponsorship actions removed as part of ads migration

/**
 * Fetch pending sponsorships for a room (host only)
 */
//

/**
 * Update sponsorship status (approve or decline)
 */
//

/**
 * Fetch sponsorship status for a user
 */
//

/**
 * Withdraw a sponsorship request
 */
//

/**
 * Activate an approved sponsorship after successful payment
 */
//

/**
 * Fetch live sponsorships for a room
 */
//

/**
 * Update room (for setting reminders or other updates)
 */
export async function updateRoom(
  roomId: string, 
  updateData: {
    interested?: string;
    status?: string;
    endTime?: string;
    participants?: string[];
    action?: 'add' | 'remove';
  }, 
  token: string | null = null
) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/${roomId}`, {
    method: 'PUT',
    body: updateData,
    authToken: token
  });
}

/**
 * Start a room (create HMS room and set status to ongoing)
 */
export async function startRoom(roomId: string, token: string | null = null) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${URL}/api/rooms/protected/start/${roomId}`, {
    method: 'POST',
    authToken: token
  });
}

/**
 * Fetch active peers in an HMS room using 100ms Management API
 */
export async function fetchHMSActivePeers(hmsRoomId: string) {
  const HMS_MANAGEMENT_TOKEN = process.env.HMS_MANAGEMENT_TOKEN;
  
  if (!HMS_MANAGEMENT_TOKEN) {
    console.error('HMS_MANAGEMENT_TOKEN not found in environment variables');
    return { data: null, status: 500, ok: false };
  }

  try {
    const response = await fetch(`https://api.100ms.live/v2/active-rooms/${hmsRoomId}/peers`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HMS_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    return {
      data,
      status: response.status,
      ok: response.ok
    };
  } catch (error) {
    console.error('Error fetching HMS active peers:', error);
    throw error;
  }
}

/**
 * Ads controls helpers
 */
function ensureRoomId(roomId: string) {
  if (!roomId) {
    throw new Error('roomId is required');
  }
}

function ensureAuthHeader(authHeader: string | null | undefined) {
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  return authHeader;
}

async function postAdsControl(
  roomId: string,
  pathSuffix: string,
  authHeader: string,
  body?: Record<string, unknown>
) {
  ensureRoomId(roomId);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  return fetchAPI(`${backend}/api/ads/protected/rooms/${roomId}/${pathSuffix}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
    },
    body,
  });
}

export async function startAdsSession(roomId: string, authHeader: string, options?: { webhookUrl?: string }) {
  const header = ensureAuthHeader(authHeader);
  ensureRoomId(roomId);
  let webhookUrl = options?.webhookUrl;
  if (!webhookUrl) {
    const baseUrl = process.env.NEXT_PUBLIC_URL;
    if (!baseUrl) {
      throw new Error('NEXT_PUBLIC_URL is not set');
    }
    webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/ads`;
  }

  const res = await postAdsControl(roomId, 'start', header, { webhookUrl });
  if (!res.ok) {
    throw new Error(res?.data?.error || 'Failed to start ads session');
  }
  return res;
}

export async function stopAdsSession(roomId: string, authHeader: string) {
  const header = ensureAuthHeader(authHeader);
  const res = await postAdsControl(roomId, 'stop', header);
  if (!res.ok) {
    throw new Error(res?.data?.error || 'Failed to stop ads session');
  }
  return res;
}

export async function notifyAdsRoomEnded(roomId: string, authHeader: string) {
  const header = ensureAuthHeader(authHeader);
  const res = await postAdsControl(roomId, 'room-ended', header);
  if (!res.ok) {
    throw new Error(res?.data?.error || 'Failed to notify room ended');
  }
  return res;
}

export async function getAdsSessionState(roomId: string) {
  ensureRoomId(roomId);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const env = process.env.NEXT_PUBLIC_ENV;
  let authHeader = 'Bearer dev';
  if (env !== 'DEV') {
    const tokenResponse = await sdk.quickAuth.getToken();
    authHeader = `Bearer ${tokenResponse.token}`;
  }

  return fetchAPI(`${backend}/api/ads/protected/sessions/${roomId}`, {
    cache: 'no-store',
    headers: {
      Authorization: authHeader,
    },
  });
}

export async function getCachedAdsState(roomId: string) {
  ensureRoomId(roomId);
  return getCurrent(roomId);
}

const shouldLogAdsWebhook = process.env.NODE_ENV !== 'production';

function logAdsWebhook(message: string, meta?: Record<string, unknown>) {
  if (!shouldLogAdsWebhook) return;
  if (meta) {
    console.log(`[AdsWebhook] ${message}`, meta);
  } else {
    console.log(`[AdsWebhook] ${message}`);
  }
}

type AdsWebhookHeaders = {
  signature?: string;
  timestamp?: string;
  eventType?: string;
  idempotencyKey?: string;
};

export async function processAdsWebhookEvent(
  rawBody: string,
  headers: AdsWebhookHeaders
): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = process.env.ADS_WEBHOOK_SECRET;
  if (!secret) {
    return { status: 500, body: { error: 'ADS_WEBHOOK_SECRET is not configured' } };
  }

  const isValid = verifyAdsWebhook(headers.signature, headers.timestamp, rawBody, secret);
  if (!isValid) {
    logAdsWebhook('Invalid webhook signature', { eventType: headers.eventType, timestamp: headers.timestamp });
    return { status: 401, body: { error: 'Invalid signature' } };
  }

  if (isDuplicateIdempotency(headers.idempotencyKey)) {
    logAdsWebhook('Duplicate webhook skipped', { eventType: headers.eventType, idempotencyKey: headers.idempotencyKey });
    return { status: 200, body: { ok: true, deduped: true } };
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error('Failed to parse ads webhook payload', error);
    return { status: 400, body: { error: 'Invalid JSON payload' } };
  }

  const roomId = payload?.roomId;
  if (!roomId) {
    return { status: 400, body: { error: 'Missing roomId in payload' } };
  }

  logAdsWebhook('Event received', {
    eventType: headers.eventType,
    roomId,
    reservationId: payload?.reservationId,
    sessionId: payload?.sessionId,
  });

  switch (headers.eventType) {
    case 'ads.session.started':
      setSessionRunning(roomId, payload.sessionId, payload.startedAt);
      logAdsWebhook('Session marked running', { roomId, sessionId: payload.sessionId });
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
        logAdsWebhook('Ad completion processed', { roomId, reservationId: payload.reservationId });
      }
      break;
    case 'ads.session.stopped':
    case 'ads.session.idle':
      stopSession(roomId);
      logAdsWebhook('Session stopped', {
        roomId,
        sessionId: payload.sessionId,
        reason: headers.eventType === 'ads.session.idle' ? payload?.reason || 'idle' : 'stopped',
      });
      break;
    default:
      console.warn('Unhandled ads webhook event', headers.eventType);
      logAdsWebhook('Unhandled event', { eventType: headers.eventType, roomId });
      break;
  }

  return { status: 200, body: { ok: true } };
}

export async function handleFarcasterWebhookEvent(requestJson: unknown) {
  try {
    const data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
    if (!data) {
      return { status: 400, body: { message: 'Invalid webhook data' } };
    }

    const { fid, appFid, event } = data as { fid: number; appFid: number; event: Record<string, unknown> };
    console.log('Received webhook event:', event);
    console.log('For user FID:', fid);
    console.log('In app FID:', appFid);

    return { status: 200, body: { message: 'Webhook received successfully' } };
  } catch (error) {
    console.error('Failed to verify Farcaster webhook', error);
    return { status: 400, body: { message: 'Invalid webhook data' } };
  }
}