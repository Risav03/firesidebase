"use client";

import { useState } from 'react';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { getEthPrice } from '@/utils/commons';
import { encodeFunctionData, numberToHex } from 'viem';
import { erc20Abi } from '@/utils/contract/abis/erc20abi';
import { firebaseAdsAbi } from '@/utils/contract/abis/firebaseAdsAbi';
import { contractAdds } from '@/utils/contract/contractAdds';
import { createBaseAccountSDK, getCryptoKeyAccount, base } from '@base-org/account';
import { readContract } from '@wagmi/core';
import { config } from '@/utils/providers/rainbow';

export default function PurchaseAdPage() {
  const { user } = useGlobalContext();
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rooms, setRooms] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(5);
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  

  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

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

  const createOnBackend = async (txHash: string) => {
    if (!user?.fid) return;
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
  };

  const handlePayETH = async () => {
    // Mock transaction: assume success and create ad on backend
    if (!price) await quotePrice();
    setCreating(true);
    try {
      const txHash = `mock-eth-${Date.now()}`;
      await createOnBackend(txHash);
      alert('Ad created (mock ETH tx).');
    } catch (e: any) {
      alert(e?.message || 'Failed to create ad');
    } finally {
      setCreating(false);
    }
  };

  const handlePayUSDC = async () => {
    // Mock transaction: assume success and create ad on backend
    if (!price) await quotePrice();
    setCreating(true);
    try {
      const txHash = `mock-usdc-${Date.now()}`;
      await createOnBackend(txHash);
      alert('Ad created (mock USDC tx).');
    } catch (e: any) {
      alert(e?.message || 'Failed to create ad');
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
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handlePayETH} disabled={creating || !title || !imageUrl} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">{creating ? '...' : 'Pay with ETH'}</button>
            <button onClick={handlePayUSDC} disabled={creating || !title || !imageUrl} className="bg-fireside-orange hover:bg-orange-600 text-white px-4 py-2 rounded">{creating ? '...' : 'Pay with USDC'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}


