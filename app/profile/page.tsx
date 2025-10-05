'use client'

import { useGlobalContext } from '@/utils/providers/globalContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import NavigationWrapper from '@/components/NavigationWrapper';
import { IoIosArrowBack } from 'react-icons/io';
import { IoRefreshOutline } from 'react-icons/io5';
import { toast } from 'react-toastify';
import sdk from '@farcaster/miniapp-sdk';
import { fetchUserRooms, refreshUserProfile } from '@/utils/serverActions';

export default function ProfilePage() {
  const { user, setUser } = useGlobalContext();
  const router = useRouter();
  const [hostedRooms, setHostedRooms] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/');
    } else if (user.hostedRooms && user.hostedRooms.length > 0) {
      // Fetch hosted rooms details from API
      fetchUserRooms(user.username)
        .then(response => {
          if (response.ok) {
            setHostedRooms(response.data.data.rooms || []);
          }
        });
    } else {
      setHostedRooms([]);
    }
  }, [user, router]);

  const handleRefreshProfile = async () => {
    if (!user || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      var token:any ;
      const env = process.env.NEXT_PUBLIC_ENV;
      if (env !== "DEV" && !token) {
        token = ((await sdk.quickAuth.getToken()).token);
      }
      
      const response = await refreshUserProfile(token);
      
      if (response.ok) {
        toast.success('Profile refreshed successfully!');
        window.location.reload();
      } else {
        console.error('Failed to refresh profile');
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-white mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Profile</h1>
            <p className="text-gray-300 text-lg">Your account information</p>
          </div>
          
          <div className="bg-white/10 border border-white/80 rounded-lg px-4 py-8">
            {/* Profile Picture and Refresh Button */}
            <div className="text-center mb-6 relative">
              <div className="w-24 h-24 mx-auto mb-4">
                {user.pfp_url ? (
                  <img 
                    src={user.pfp_url} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-full object-cover border-4 border-white"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* Refresh button */}
              <button 
                onClick={handleRefreshProfile}
                disabled={isRefreshing}
                className="absolute top-0 right-0 flex items-center justify-center px-3 py-1 text-sm bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-full transition-colors"
                title="Refresh profile data"
              >
                <IoRefreshOutline className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />Refetch
              </button>
            </div>

            {/* Profile Information */}
            <div className="space-y-4">
              <div className="border-b border-gray-600 pb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <p className="text-white text-lg font-medium">
                  {user.username || 'Not set'}
                </p>
              </div>
            </div>

            {/* Previous Spaces Section */}
            {/* <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4">Previous Spaces</h2>
              <div className="flex space-x-4 overflow-x-auto">
                {hostedRooms.length === 0 ? (
                  <div className="w-full h-32 px-10 text-nowrap bg-white/10 rounded-lg flex items-center justify-center text-gray-400">
                    No hosted spaces yet.
                  </div>
                ) : (
                  hostedRooms.map((room, idx) => (
                    <div
                      key={room._id || idx}
                      className="w-60 h-32 px-4 py-2 bg-gray-700 rounded-lg flex flex-col justify-center text-white"
                    >
                      <div className="font-bold text-lg truncate mb-1">{room.name}</div>
                      <div className="text-xs text-gray-300 mb-1 truncate">{room.description}</div>
                      <div className="text-xs text-pink-400 mb-1">Tags: {room.topics?.join(', ')}</div>
                      <div className="text-xs text-orange-400">Status: {room.status}</div>
                    </div>
                  ))
                )}
              </div>
            </div> */}

            {/* Statistics Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4">Statistics</h2>
              <div className="space-y-4">
                <div className="border-b border-gray-600 pb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Total Hosted Rooms
                  </label>
                  <p className="text-white text-lg font-medium">{user.hostedRooms.length || 0} </p>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Total Audience Engaged
                  </label>
                  <p className="text-white text-lg font-medium">0</p>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Audience Engaged
                  </label>
                  <p className="text-white text-lg font-medium">0</p>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-0">
                    Total Earnings
                  </label>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Earnings from tips + ads
                  </label>
                  <p className="text-white text-lg font-medium">$0</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-6 ">
              <div className="w-full">
                {/* <button
                  onClick={() => router.push('/')}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Explore Rooms
                </button> */}
                
                <button
                  onClick={() => window.history.back()}
                  className="gradient-fire text-white w-full font-medium py-3 px-4 rounded-md transition-colors"
                >
                  <IoIosArrowBack className="inline mr-2" />
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <NavigationWrapper />
    </>
  );
}
