'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalContext } from '@/utils/providers/globalContext';
import CreateRoomModal from '@/components/CreateRoomModal';

export default function Navigation() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();
  const { user } = useGlobalContext();

  const handleCreateRoom = () => {
    setShowCreateModal(true);
  };

  const handleProfileClick = () => {
    router.push('/profile');
  };

  const handleExploreClick = () => {
    router.push('/');
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-600 z-50">
        <div className="max-w-md mx-auto px-20 py-3">
          <div className="flex items-center justify-between">
            {/* Explore Button */}
            <button
              onClick={handleExploreClick}
              className="flex flex-col items-center space-y-1 text-gray-300 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs">Explore</span>
            </button>

            {/* Create Room Button */}
            <button
              onClick={handleCreateRoom}
              className="flex flex-col items-center space-y-1 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>

            {/* Profile Button */}
            <button
              onClick={handleProfileClick}
              className="flex flex-col items-center space-y-1 text-gray-300 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs">Profile</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)} 
        />
      )}
    </>
  );
}
