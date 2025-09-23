"use client";

import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { RiLoader5Fill } from "react-icons/ri";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from "@/components/UI/drawer";
import { useHMSStore, selectPeers } from "@100mslive/react-sdk";
import sdk from "@farcaster/miniapp-sdk";
import { createSponsorship } from "@/utils/serverActions";

interface SponsorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export default function SponsorDrawer({
  isOpen,
  onClose,
  roomId,
}: SponsorDrawerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [sponsorDuration, setSponsorDuration] = useState<number>(5 * 60); // 5 minutes in seconds by default
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get all peers in the room
  const peers = useHMSStore(selectPeers);
  const peerCount = peers.length;

  const maxDuration = 15 * 60; // 15 minutes in seconds
  
  // Calculate slider percentage for styling
  const sliderPercentage = (sponsorDuration / maxDuration) * 100;

  // Helper function to format time
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} sec`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins} min${mins !== 1 ? 's' : ''} ${secs > 0 ? `${secs} sec` : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours} hr${hours !== 1 ? 's' : ''} ${mins > 0 ? `${mins} min${mins !== 1 ? 's' : ''}` : ''}`;
    }
  };

  // Calculate estimated price based on duration
  const calculatePrice = (durationInSeconds: number) => {
    // Base rate: $1 per minute
    const baseRate = 1;
    const durationInMinutes = durationInSeconds / 60;
    
    // Factor in peer count - each additional peer increases value by 5%
    // Base is 1x for 1-5 peers, then 5% more for each additional peer up to a 50% increase
    const peerFactor = peerCount%10;
    
    // Calculate price with all factors
    const price = baseRate * durationInMinutes * peerFactor;
    
    // Round to 2 decimal places
    return Math.round(price * 100) / 100;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      toast.error("Please upload a banner image");
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading("Processing your sponsorship request...");

    try {
      // Since selectedImage is already a base64 string, extract the base64 data
      // We'll use the base64 string directly as the backend expects a string
      const env = process.env.NEXT_PUBLIC_ENV;
      
      // Extract just the base64 part without the data URL prefix
      const base64Data = selectedImage.split(',')[1];
      
      console.log("Using base64 image data, length:", base64Data.length);
      
      let token:any = null;
      if(env !== "DEV"){
        token = (await sdk.quickAuth.getToken()).token;
      }
      
      // Use the server action with the base64 string
      const result = await createSponsorship({
        roomId,
        duration: sponsorDuration,
        imageBuffer: base64Data, // send as base64 string
      }, token);

      console.log("Sponsorship creation result:", result);
      
      if (result.ok) {
        toast.dismiss(loadingToast);
        toast.success("Sponsorship created successfully!");
        onClose();
      } else {
        toast.dismiss(loadingToast);
        toast.error(`Failed to create sponsorship: ${result.data?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error submitting sponsorship request:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to submit sponsorship request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-black/50 backdrop-blur-2xl text-white border-t border-fireside-orange/30">
        <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-fireside-orange/30"></div>
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-bold text-white">Sponsor This Room</DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-6">
          <div className="mb-6">
            <label className="block text-lg font-bold text-fireside-orange mb-3">
              Upload Banner
            </label>
            
            <div
              className={`relative w-full min-h-[120px] border-2 border-dashed rounded-lg ${
                isDragging ? 'border-fireside-orange bg-black/60' : 'border-gray-600 bg-black/40'
              } cursor-pointer`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              
              {selectedImage ? (
                <div className="relative w-full h-full min-h-[120px] aspect-[3/1] object-cover rounded-lg overflow-hidden">
                  <img 
                    src={selectedImage} 
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(null);
                    }}
                    className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <p className="absolute bottom-2 right-2 text-xs text-white bg-black/60 px-2 py-1 rounded">
                    Recommended size: 1500x500
                  </p>
                </div>
              ) : (
                <div className="w-full aspect-[3/1] flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center p-2">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-300 text-sm text-center">
                    Click to upload or drag and drop
                    <span className="block text-xs text-gray-500">
                      Recommended size: 1500x500
                    </span>
                    <span className="block text-xs text-gray-500">
                      Larger images will be scaled to fit
                    </span>
                  </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-lg font-bold text-fireside-orange mb-3">
              Sponsorship Duration: {formatTime(sponsorDuration)}
            </label>
            <input
              type="range"
              min="60"
              max={maxDuration}
              step="60"
              value={sponsorDuration}
              onChange={(e) => setSponsorDuration(parseInt(e.target.value))}
              className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider-fireside"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>1 min</span>
              <span>15 mins</span>
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-lg font-bold text-fireside-orange mb-3">
              Estimated Price
            </label>
            <div className="w-full bg-black/40 border border-fireside-orange/30 text-white p-4 rounded-lg text-center">
              <span className="text-2xl font-bold">${calculatePrice(sponsorDuration)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Pricing is based on duration and audience size ({peerCount} {peerCount === 1 ? 'user' : 'users'} in room).
              {peerCount > 5 && ' Premium audience pricing applied.'}
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || !selectedImage}
            className={`w-full gradient-fire text-white font-semibold py-3 px-4 rounded-lg transition-colors ${
              isLoading || !selectedImage ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <span className="flex gap-2 items-center justify-center">
              {isLoading ? (
                <RiLoader5Fill className="animate-spin" />
              ) : null}
              Confirm Sponsorship
            </span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}