type AdCurrent = {
  reservationId: string;
  adId: string;
  title: string;
  imageUrl: string;
  durationSec: number;
  startedAt: string;
  sessionId: string;
};

type RoomSessionState = 'running' | 'stopped';

type RoomCache = {
  state: RoomSessionState;
  current?: AdCurrent;
};

const roomIdToState = new Map<string, RoomCache>();
const idempotencyKeys = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function pruneIdempotencyKeys() {
  const now = Date.now();
  for (const [key, ts] of idempotencyKeys.entries()) {
    if (now - ts > IDEMPOTENCY_TTL_MS) idempotencyKeys.delete(key);
  }
}

export function isDuplicateIdempotency(key?: string) {
  if (!key) return false;
  pruneIdempotencyKeys();
  if (idempotencyKeys.has(key)) return true;
  idempotencyKeys.set(key, Date.now());
  return false;
}

export function setSessionRunning(roomId: string, sessionId: string, startedAt: string) {
  const prev = roomIdToState.get(roomId) || { state: 'stopped' as RoomSessionState };
  roomIdToState.set(roomId, { ...prev, state: 'running' });
}

export function setCurrentAd(roomId: string, current: AdCurrent) {
  const prev = roomIdToState.get(roomId) || { state: 'running' as RoomSessionState };
  roomIdToState.set(roomId, { ...prev, state: 'running', current });
}

export function completeAd(roomId: string, reservationId: string) {
  const prev = roomIdToState.get(roomId);
  if (!prev) return;
  if (prev.current && prev.current.reservationId === reservationId) {
    roomIdToState.set(roomId, { ...prev, current: undefined });
  }
}

export function stopSession(roomId: string) {
  const prev = roomIdToState.get(roomId) || { state: 'stopped' as RoomSessionState };
  roomIdToState.set(roomId, { ...prev, state: 'stopped', current: undefined });
}

export function getCurrent(roomId: string): { state: RoomSessionState; current?: AdCurrent } {
  const prev = roomIdToState.get(roomId) || { state: 'stopped' as RoomSessionState };
  return prev;
}


