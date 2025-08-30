'use client'

import { useState } from 'react';
import { useNavigateWithLoader } from '@/utils/useNavigateWithLoader';
import { useGlobalContext } from '@/utils/providers/globalContext';
import toast from 'react-hot-toast';
import { topics } from '@/utils/constants';

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const navigate = useNavigateWithLoader();
  const { user } = useGlobalContext();

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9 ]+$/.test(formData.name)) {
      setNameError('Room name can only contain alphabets, numbers, and spaces.');
      toast.error('Invalid room name format');
      return;
    }
    setNameError('');
    setLoading(true);

      if (selectedTags.length === 0) {
        toast.error('Please select at least one topic tag.');
        setLoading(false);
        return;
      }
    
    try {
      toast.loading('Creating room...');
      
        const response = await fetch('/api/rooms/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            host: user?.fid || '',
            startTime: new Date().toISOString(),
            topics: selectedTags
          }),
        });
      
      const data = await response.json();
      if (data.success) {
        toast.dismiss();
        toast.success('Room created successfully! Redirecting...');
        setFormData({ name: '', description: '', startTime: '' });
    setSelectedTags([]);
        onClose();
        // Redirect to the room page
  navigate('/call/' + data.room._id);
      } else {
        toast.dismiss();
        toast.error('Error creating room: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast.dismiss();
      toast.error('Error creating room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
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
          
          {/*
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
          */}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Topics (up to 3)*
              </label>
              <div className="flex flex-wrap gap-2">
                {topics.map(tag => (
                  <button
                    type="button"
                    key={tag}
                    className={`px-3 py-1 rounded-full border text-sm transition-colors ${selectedTags.includes(tag) ? 'gradient-fire font-bold text-white border-none' : 'bg-gray-700 text-gray-300 border-gray-500'} ${selectedTags.length >= 3 && !selectedTags.includes(tag) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      } else if (selectedTags.length < 3) {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    disabled={selectedTags.length >= 3 && !selectedTags.includes(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {selectedTags.length === 0 && <p className="text-red-500 text-sm mt-1">Please select at least one topic.</p>}
              {selectedTags.length > 3 && <p className="text-red-500 text-sm mt-1">You can select up to 3 topics only.</p>}
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
              className="flex-1 gradient-fire disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
