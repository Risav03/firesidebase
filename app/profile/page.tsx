'use client'

import { useGlobalContext } from '@/utils/providers/globalContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import NavigationWrapper from '@/components/NavigationWrapper';

export default function ProfilePage() {
  const { user } = useGlobalContext();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-white mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900">
        <div className="max-w-2xl mx-auto p-6 pb-24">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Profile</h1>
            <p className="text-gray-300 text-lg">Your account information</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            {/* Profile Picture */}
            <div className="text-center mb-6">
              <div className="w-24 h-24 mx-auto mb-4">
                {user.pfp_url ? (
                  <img 
                    src={user.pfp_url} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-600"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Information */}
            <div className="space-y-4">
              <div className="border-b border-gray-600 pb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <p className="text-white text-lg font-medium">
                  {user.displayName || 'Not set'}
                </p>
              </div>

              <div className="border-b border-gray-600 pb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <p className="text-white text-lg font-medium">
                  {user.username || 'Not set'}
                </p>
              </div>

              <div className="border-b border-gray-600 pb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Farcaster ID
                </label>
                <p className="text-white text-lg font-medium">
                  {user.fid || 'Not set'}
                </p>
              </div>

              <div className="border-b border-gray-600 pb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bio
                </label>
                <p className="text-white text-lg">
                  {user.bio || 'No bio available'}
                </p>
              </div>

              <div className="border-b border-gray-600 pb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Follower Count
                </label>
                <p className="text-white text-lg">
                  {user.followerCount ? user.followerCount.toLocaleString() : 'Not available'}
                </p>
              </div>

              <div className="border-b border-gray-600 pb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Following Count
                </label>
                <p className="text-white text-lg">
                  {user.followingCount ? user.followingCount.toLocaleString() : 'Not available'}
                </p>
              </div>

              <div className="pt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Status
                </label>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-white">Active</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t border-gray-600">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Explore Rooms
                </button>
                
                <button
                  onClick={() => window.history.back()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m2-5a7 7 0 00-7 7h18" />
                  </svg>
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
