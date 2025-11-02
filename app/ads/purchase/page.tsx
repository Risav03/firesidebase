"use client";

import { useState } from 'react';
import { useGlobalContext } from '@/utils/providers/globalContext';

export default function PurchaseAdPage() {
  const { user } = useGlobalContext();
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rooms, setRooms] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(5);
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const quotePrice = async () => {
    setLoading(true);
    try {
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backend}/api/ads/public/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms, minutes }),
      });
      const data = await res.json();
      setPrice(data?.priceUsd ?? data?.data?.priceUsd ?? null);
    } finally {
      setLoading(false);
    }
  };

  const handlePayAndCreate = async () => {
    if (!user?.fid) return;
    if (!price) await quotePrice();

    // Expect a wallet flow to return txHash programmatically
    // Integrators should implement window.firesideRequestAdPayment(amountUsd) => Promise<string>
    const requestPayment = (window as any).firesideRequestAdPayment as undefined | ((amountUsd: number) => Promise<string>);
    if (!requestPayment) {
      alert('Wallet payment integration required. Please implement window.firesideRequestAdPayment(amountUsd) to return txHash.');
      return;
    }

    setCreating(true);
    try {
      const txHash = await requestPayment(Number(price));
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backend}/api/ads/protected/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-fid': String(user.fid),
        },
        body: JSON.stringify({ title, imageUrl, rooms, minutes, txHash }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create ad');
      }
      alert('Ad created successfully');
    } catch (e: any) {
      alert(e?.message || 'Payment or creation failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="bg-gray-900 w-full max-w-md rounded-xl p-5 border border-white/10">
        <h1 className="text-white text-xl font-semibold mb-4">Purchase Advertisement</h1>
        <div className="space-y-4">
          <div>
            <label className="text-gray-300 text-sm block mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Your ad title" className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" />
          </div>
          <div>
            <label className="text-gray-300 text-sm block mb-1">Image URL</label>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-300 text-sm block mb-1">Rooms</label>
              <input type="number" min={1} value={rooms} onChange={e => setRooms(Number(e.target.value))} className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">Minutes</label>
              <input type="number" min={1} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={quotePrice} disabled={loading} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded">{loading ? '...' : 'Get Quote'}</button>
            {price !== null && <span className="text-gray-300 text-sm">${price} USD</span>}
          </div>
          <button onClick={handlePayAndCreate} disabled={creating || !title || !imageUrl} className="w-full bg-fireside-orange hover:bg-orange-600 text-white px-4 py-2 rounded">{creating ? 'Processing…' : 'Pay & Create'}</button>
        </div>
      </div>
    </div>
  );
}


