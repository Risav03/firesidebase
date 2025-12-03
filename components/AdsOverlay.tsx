"use client";

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './UI/Card';

type CurrentAd = {
  reservationId: string;
  adId: string;
  title: string;
  imageUrl: string;
  durationSec: number;
  startedAt: string;
  sessionId: string;
};

function remainingMs(current: { durationSec: number; startedAt: string }) {
  const end = new Date(current.startedAt).getTime() + current.durationSec * 1000;
  return Math.max(0, end - Date.now());
}

export default function AdsOverlay({ roomId }: { roomId: string }) {
  const [current, setCurrent] = useState<CurrentAd | null>(null);
  const [msLeft, setMsLeft] = useState<number>(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(2000);

  const parsePayload = (payload: any) => {
    // Accept { state, current } or { success, data: { state, current } }
    const body = payload?.state ? payload : payload?.data ? payload.data : payload;
    const state = body?.state;
    const currentAd = body?.current;
    return { state, currentAd };
  };

  const applySnapshot = useCallback((snapshot: any) => {
    const { state, currentAd } = parsePayload(snapshot);
    if (state === 'running' && currentAd) {
      setCurrent(currentAd);
      setMsLeft(remainingMs(currentAd));
    } else {
      setCurrent(null);
      setMsLeft(0);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const connect = () => {
      if (!isMounted) return;
      eventSourceRef.current?.close();
      const source = new EventSource(`/api/ads/stream?roomId=${encodeURIComponent(roomId)}`);
      eventSourceRef.current = source;

      const resetRetryDelay = () => {
        retryDelayRef.current = 2000;
      };

      source.addEventListener('ad-state', (event) => {
        resetRetryDelay();
        try {
          console.log('[AdsOverlay] SSE payload', (event as MessageEvent).data);
        } catch {
          // ignore logging failures
        }
        try {
          const payload = JSON.parse((event as MessageEvent).data);
          applySnapshot(payload);
        } catch {
          // ignore malformed payloads
        }
      });

      source.onerror = () => {
        source.close();
        if (!isMounted) return;
        const delay = Math.min(retryDelayRef.current, 30000);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          retryDelayRef.current = Math.min(delay * 1.5, 30000);
          connect();
        }, delay);
      };
    };

    connect();

    return () => {
      isMounted = false;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [roomId, applySnapshot]);

  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => {
      const left = remainingMs(current);
      setMsLeft(left);
      if (left <= 0) {
        clearInterval(id);
        setCurrent(null);
      }
    }, 250);
    return () => clearInterval(id);
  }, [current]);

  const secondsLeft = useMemo(() => Math.max(0, Math.ceil(msLeft / 1000)), [msLeft]);
  const progress = useMemo(() => {
    if (!current) return 0;
    const total = current.durationSec * 1000;
    if (total <= 0) return 0;
    const clampedLeft = Math.max(0, Math.min(msLeft, total));
    const elapsed = total - clampedLeft;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [current, msLeft]);

  if (!current) return null;

  return (
    <Card className="pointer-events-none fixed inset-x-0 bottom-32 z-[1000] flex object-cover justify-center aspect-[4/1] mx-2 sm:bottom-10 bg-fireside-orange/20 border border-fireside-orange/20 overflow-hidden ">
      <div className='relative w-full h-full'>
            <div className="aspect-[5/1] w-full object-cover relative ">
                <Image width={128} height={72} src={current.imageUrl} alt={current.title} className="h-full w-full object-cover" />
              </div>

              <div className="flex-1 min-w-0 absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-b from-transparent to-black/90">
              {/* <div className="flex items-center justify-end text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70"> */}
                {/* <span className="text-fireside-orange">Sponsored</span> */}
                {/* <span className="text-white">{secondsLeft}s left</span> */}
              {/* </div> */}
              <p className="mt-1 text-sm font-semibold text-white truncate sm:text-base">{current.title}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fireside-orange via-orange-400 to-amber-300 transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
      </div>
      {/* <div className="pointer-events-auto w-full max-w-xl">
        <div className="rounded-2xl bg-gradient-to-r from-fireside-orange/60 via-fireside-orange/20 to-transparent p-[1px] shadow-[0_15px_45px_rgba(0,0,0,0.65)]">
          <div className="flex items-center gap-4 rounded-2xl bg-fireside-dark_orange/80 p-3 backdrop-blur-xl sm:p-4"> */}
            {/* <div className="flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30"> */}
              
            {/* </div> */}
            {/* <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                <span className="text-fireside-orange">Sponsored</span>
                <span className="text-white">{secondsLeft}s left</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white truncate sm:text-base">{current.title}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fireside-orange via-orange-400 to-amber-300 transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div> */}
          {/* </div>
        </div>
      </div> */}
    </Card>
  );
}


