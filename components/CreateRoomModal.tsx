'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalContext } from '@/utils/providers/globalContext';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: ''
  });
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const router = useRouter();
  const { user } = useGlobalContext();

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9 ]+$/.test(formData.name)) {
      setNameError('Room name can only contain alphabets, numbers, and spaces.');
      return;
    }
    setNameError('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          host: user?.fid || '',
          startTime: new Date(formData.startTime).toISOString()
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Room created successfully! Redirecting...');
        setFormData({ name: '', description: '', startTime: '' });
        onClose();
        // Redirect to the explore page to show the new room
        router.push('/call/' + data.room._id);
      } else {
        alert('Error creating room: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Error creating room');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Create New Room</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={createRoom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room Name*
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (/^[a-zA-Z0-9 ]+$/.test(e.target.value)) {
                  setNameError('');
                } else {
                  setNameError('Room name can only contain alphabets, numbers, and spaces.');
                }
              }}
              className={`w-full px-3 py-2 bg-gray-700 border ${nameError ? 'border-red-500' : 'border-gray-600'} rounded-md text-white`}
              required
            />
            {nameError && <p className="text-red-500 text-sm mt-1">{nameError}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Start Time*
            </label>
            <input
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({...formData, startTime: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              required
            />
          </div>
          
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
