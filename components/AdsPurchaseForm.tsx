"use client";

import { useState } from 'react';
import { useGlobalContext } from '@/utils/providers/globalContext';

interface AdsPurchaseFormProps {
  handleETHPayment: (price:number, formData: FormData) => void;
  handleERC20Payment: (price:number, formData: FormData) => void;
  loading?: boolean;
}

export default function AdsPurchaseForm({ handleERC20Payment, handleETHPayment, loading = false }: AdsPurchaseFormProps) {
  const { user } = useGlobalContext();
  const [title, setTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [rooms, setRooms] = useState<number>(1);
  const [minutes, setMinutes] = useState<number>(5);
  const [minParticipants, setMinParticipants] = useState<number>(1);
  const [price, setPrice] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);

  const BASE_PRICE = 1; // Base price per room per minute per 10 participants in ETH

  const quotePrice = () => {
      const priceCalc = rooms * minutes * (Math.round(minParticipants / 10) + 1) * BASE_PRICE;
      return priceCalc;
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
    formData.append('minParticipants', minParticipants.toString());
    formData.append('paymentMethod', paymentMethod);
    if (selectedImage) {
      formData.append('image', selectedImage);
    }

    const price = quotePrice();
    
    if(paymentMethod === 'USDC') {
      handleERC20Payment(price, formData);
    }
    else if (paymentMethod === 'ETH') {
      handleETHPayment(price, formData);
    }
  };

  const isFormValid = title && selectedImage && rooms > 0 && minutes > 0 && minParticipants > 0;

  return (
    <div className="min-h-screen flex items-start justify-center p-4 pb-32">
      <div className="bg-black w-full max-w-md rounded-xl p-5 border border-white/10">
        <h1 className="text-white text-xl font-semibold mb-4">Purchase Advertisement</h1>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="ad-title" className="text-gray-300 text-sm block mb-2">Title</label>
            <input 
              id="ad-title"
              type="text"
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="Your ad title" 
              className="w-full px-4 py-3 text-base rounded bg-black/50 text-white border border-white/10 focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all" 
              required
            />
          </div>
          
          <div>
            <label htmlFor="ad-image" className="text-gray-300 text-sm block mb-2">Image</label>
            <input 
              id="ad-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-4 py-3 text-base rounded bg-black/50 text-white border border-white/10 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-fireside-orange file:text-white hover:file:bg-orange-600 file:cursor-pointer cursor-pointer focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all"
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
              <label htmlFor="ad-rooms" className="text-gray-300 text-sm block mb-2">Rooms</label>
              <input 
                id="ad-rooms"
                type="number" 
                min={1} 
                value={rooms} 
                onChange={e => setRooms(Number(e.target.value))} 
                className="w-full px-4 py-3 text-base rounded bg-black/50 text-white border border-white/10 focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all" 
                required
              />
            </div>
            <div>
              <label htmlFor="ad-minutes" className="text-gray-300 text-sm block mb-2">Minutes</label>
              <input 
                id="ad-minutes"
                type="number" 
                min={1} 
                value={minutes} 
                onChange={e => setMinutes(Number(e.target.value))} 
                className="w-full px-4 py-3 text-base rounded bg-black/50 text-white border border-white/10 focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all" 
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="ad-participants" className="text-gray-300 text-sm block mb-2">Minimum participants</label>
            <input
              id="ad-participants"
              type="number"
              min={1}
              value={minParticipants}
              onChange={e => setMinParticipants(Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-4 py-3 text-base rounded bg-black/50 text-white border border-white/10 focus:border-fireside-orange focus:outline-none focus:ring-2 focus:ring-fireside-orange/50 transition-all"
              required
            />
            <p className="text-gray-400 text-xs mt-2">Ads will begin automatically once a room meets this audience size.</p>
          </div>
        
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button 
              type="button"
              onClick={() => handleSubmit('ETH')} 
              disabled={loading || !isFormValid} 
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-3 text-base rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : 'Pay with ETH'}
            </button>
            <button 
              type="button"
              onClick={() => handleSubmit('USDC')} 
              disabled={loading || !isFormValid} 
              className="bg-fireside-orange hover:bg-orange-600 active:bg-orange-700 text-white px-4 py-3 text-base rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : 'Pay with USDC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}