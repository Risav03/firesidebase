"use client";

import { useEffect, useMemo, useState } from 'react';

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

  useEffect(() => {
    let isMounted = true;
    const fetchCurrent = async () => {
      try {
        const res = await fetch(`/api/ads/sessions/${roomId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.state === 'running' && data.current) {
          if (!isMounted) return;
          setCurrent(data.current);
          setMsLeft(remainingMs(data.current));
        } else {
          setCurrent(null);
          setMsLeft(0);
        }
      } catch {}
    };
    fetchCurrent();
    return () => { isMounted = false; };
  }, [roomId]);

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

  const secondsLeft = useMemo(() => Math.ceil(msLeft / 1000), [msLeft]);

  if (!current) return null;

  return (
    <div className="fixed top-[4rem] left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div className="bg-black/80 border border-white/10 rounded-xl p-3 max-w-3xl w-[92%] flex items-center gap-4">
        <div className="w-20 h-12 bg-black/40 rounded overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.imageUrl} alt={current.title} className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm truncate">{current.title}</p>
          <p className="text-gray-400 text-xs">Sponsored • {secondsLeft}s left</p>
        </div>
      </div>
    </div>
  );
}


