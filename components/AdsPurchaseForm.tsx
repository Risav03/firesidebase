"use client";

import { useState } from 'react';
import { useGlobalContext } from '@/utils/providers/globalContext';

interface AdsPurchaseFormProps {
  onSubmit: (data: FormData) => void;
  loading?: boolean;
}

export default function AdsPurchaseForm({ onSubmit, loading = false }: AdsPurchaseFormProps) {
  const { user } = useGlobalContext();
  const [title, setTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [rooms, setRooms] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(5);
  const [price, setPrice] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);

  const quotePrice = async () => {
    setQuoting(true);
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
      setQuoting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
    }
  };

  const handleSubmit = (paymentMethod: 'ETH' | 'USDC') => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('rooms', rooms.toString());
    formData.append('minutes', minutes.toString());
    formData.append('paymentMethod', paymentMethod);
    if (selectedImage) {
      formData.append('image', selectedImage);
    }
    if (price) {
      formData.append('price', price.toString());
    }
    onSubmit(formData);
  };

  const isFormValid = title && selectedImage && rooms > 0 && minutes > 0;

  return (
    <div className="min-h-screen flex items-start justify-center p-4 pb-32">
      <div className="bg-black w-full max-w-md rounded-xl p-5 border border-white/10">
        <h1 className="text-white text-xl font-semibold mb-4">Purchase Advertisement</h1>
        <form className="space-y-4">
          <div>
            <label className="text-gray-300 text-sm block mb-1">Title</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="Your ad title" 
              className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" 
              required
            />
          </div>
          
          <div>
            <label className="text-gray-300 text-sm block mb-1">Image</label>
            <input 
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-fireside-orange file:text-white hover:file:bg-orange-600"
              required
            />
            {selectedImage && (
              <div className="mt-2">
                <img 
                  src={URL.createObjectURL(selectedImage)} 
                  alt="Preview" 
                  className="w-full h-32 object-cover rounded border border-white/10"
                />
                <p className="text-gray-400 text-xs mt-1">{selectedImage.name}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-300 text-sm block mb-1">Rooms</label>
              <input 
                type="number" 
                min={1} 
                value={rooms} 
                onChange={e => setRooms(Number(e.target.value))} 
                className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" 
                required
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">Minutes</label>
              <input 
                type="number" 
                min={1} 
                value={minutes} 
                onChange={e => setMinutes(Number(e.target.value))} 
                className="w-full px-3 py-2 rounded bg-black/50 text-white border border-white/10" 
                required
              />
            </div>
          </div>
        
          <div className="grid grid-cols-2 gap-2">
            <button 
              type="button"
              onClick={() => handleSubmit('ETH')} 
              disabled={loading || !isFormValid} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? '...' : 'Pay with ETH'}
            </button>
            <button 
              type="button"
              onClick={() => handleSubmit('USDC')} 
              disabled={loading || !isFormValid} 
              className="bg-fireside-orange hover:bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? '...' : 'Pay with USDC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}