"use client";

import { useState } from 'react';
import { useGlobalContext } from '@/utils/providers/globalContext';
import sdk from "@farcaster/miniapp-sdk";

export default function AdsPurchaseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useGlobalContext();
  const [rooms, setRooms] = useState<string>('');
  const [minutes, setMinutes] = useState<number>(5);
  const [title, setTitle] = useState('My Sponsored Message');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleQuote = async () => {
    try {
      setLoading(true);
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backend}/api/ads/public/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms: rooms.split(',').map(r => r.trim()).filter(Boolean), minutes }),
      });
      const data = await res.json();
      if (res.ok) setPrice(data.priceUsd || data.data?.priceUsd || null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user?.fid) return;
    setLoading(true);
    try {
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const env = process.env.NEXT_PUBLIC_ENV;
      let authHeader = 'Bearer dev';
      if (env !== 'DEV') {
        const tokenResponse = await sdk.quickAuth.getToken();
        authHeader = `Bearer ${tokenResponse.token}`;
      }
      const res = await fetch(`${backend}/api/ads/protected/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          title,
          imageUrl,
          rooms: rooms.split(',').map(r => r.trim()).filter(Boolean),
          minutes,
          txHash,
        }),
      });
      if (res.ok) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-gray-900 w-full max-w-md rounded-xl p-4 border border-white/10">
        <h3 className="text-white text-lg font-semibold mb-3">Purchase Ad</h3>
        <div className="space-y-3">
          <div>
            <label className="text-gray-300 text-sm block mb-1">Rooms (comma-separated roomIds)</label>
            <input value={rooms} onChange={e => setRooms(e.target.value)} className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" />
          </div>
          <div>
            <label className="text-gray-300 text-sm block mb-1">Minutes</label>
            <input type="number" value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" />
          </div>
          <div>
            <label className="text-gray-300 text-sm block mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" />
          </div>
          <div>
            <label className="text-gray-300 text-sm block mb-1">Image URL</label>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleQuote} disabled={loading} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded">{loading ? '…' : 'Get Quote'}</button>
            {price !== null && <span className="text-gray-300 text-sm">${price} USD</span>}
          </div>
          <div>
            <label className="text-gray-300 text-sm block mb-1">txHash (enter after wallet payment)</label>
            <input value={txHash} onChange={e => setTxHash(e.target.value)} className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded">Cancel</button>
          <button onClick={handleCreate} disabled={loading || !txHash} className="bg-fireside-orange hover:bg-orange-600 text-white px-3 py-2 rounded">{loading ? '…' : 'Create Ad'}</button>
        </div>
      </div>
    </div>
  );
}


