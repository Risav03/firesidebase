'use client'

import { useState, useEffect, useRef } from 'react';
import { useNavigateWithLoader } from '@/utils/useNavigateWithLoader';
import { useGlobalContext } from '@/utils/providers/globalContext';
import toast from 'react-hot-toast';
import { topics } from '@/utils/constants';
import sdk from "@farcaster/miniapp-sdk";
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose
} from '@/components/UI/drawer';
import { createRoom } from '@/utils/serverActions';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sponsorshipEnabled, setSponsorshipEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const navigate = useNavigateWithLoader();
  const { user } = useGlobalContext();
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  // Handle mobile keyboard visibility
  useEffect(() => {
    if (typeof window === 'undefined' || !isOpen) return;

    let initialViewportHeight = window.innerHeight;
    
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      
      // More reliable keyboard detection
      const heightDifference = initialViewportHeight - currentHeight;
      const keyboardThreshold = 150; // Minimum height change to consider keyboard visible
      
      setKeyboardVisible(heightDifference > keyboardThreshold);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Ensure the focused element is within our modal
        const modal = formRef.current;
        if (modal && modal.contains(target)) {
          // Multiple timeouts to handle different keyboard animation speeds
          setTimeout(() => {
            target.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
          }, 100);
          
          // Additional scroll after keyboard is fully shown
          setTimeout(() => {
            target.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
          }, 400);
        }
      }
    };

    const handleVisualViewportChange = () => {
      if (window.visualViewport) {
        const heightDifference = window.innerHeight - window.visualViewport.height;
        setKeyboardVisible(heightDifference > 150);
      }
    };

    // Store initial height when modal opens
    initialViewportHeight = window.innerHeight;

    window.addEventListener('resize', handleResize);
    document.addEventListener('focusin', handleFocusIn);
    
    // Use Visual Viewport API if available (better for mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }
    
    // Initial check
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('focusin', handleFocusIn);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    };
  }, [isOpen]);

  const createRoomHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    // Allow all characters in room name
    if (formData.name.trim() === '') {
      setNameError('Room name cannot be empty.');
      toast.error('Room name is required');
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
      const env = process.env.NEXT_PUBLIC_ENV;

      let token: any = null;
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      const response = await createRoom({
        ...formData,
        host: user?.fid || '',
        startTime: new Date().toISOString(),
        topics: selectedTags,
        sponsorshipEnabled
      }, token);      if (response.data.success) {
        toast.dismiss();
        toast.success('Room created successfully! Redirecting...');
        setFormData({ name: '', description: '' });
        setSelectedTags([]);
        setSponsorshipEnabled(false);
        onClose();
        // Redirect to the room page
        navigate('/call/' + response.data.data._id);
      } else {
        toast.dismiss();
        toast.error('Error creating room: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast.dismiss();
      toast.error('Error creating room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent 
        className={` backdrop-blur-lg border-t border-orange-500/50 text-white p-4 mobile-drawer-content pb-20 ${
          keyboardVisible ? 'keyboard-visible' : ''
        }`}
        style={{
          // Use CSS custom properties for better mobile support
          maxHeight: keyboardVisible 
            ? 'calc(100vh - env(keyboard-inset-height, 300px))' 
            : '85vh',
          overflowY: 'auto'
        }}
      >
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-semibold text-white text-center">Create New Room</DrawerTitle>
        </DrawerHeader>
        
        <form 
          ref={formRef}
          onSubmit={createRoomHandler} 
          className="space-y-4 px-4 pb-safe"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Room Name*
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (e.target.value.trim() === '') {
                  setNameError('Room name cannot be empty.');
                } else {
                  setNameError('');
                }
              }}
              onFocus={(e) => {
                // Ensure the input is visible when focused
                setTimeout(() => {
                  e.target.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                  });
                }, 100);
              }}
              className={`w-full bg-white/10 text-white p-2 rounded-lg border ${nameError ? 'border-red-500' : 'border-orange-500/30'} focus:outline-none focus:border-orange-500 transition-colors`}
              required
            />
            {nameError && <p className="text-red-500 text-sm mt-1">{nameError}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              ref={descriptionInputRef}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              onFocus={(e) => {
                // Ensure the textarea is visible when focused
                setTimeout(() => {
                  e.target.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                  });
                }, 100);
              }}
              className="w-full bg-white/10 text-white p-2 rounded-lg border border-orange-500/30 focus:outline-none focus:border-orange-500 transition-colors"
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
                    className={`px-3 py-1 rounded-full border text-sm transition-colors ${selectedTags.includes(tag) ? 'gradient-fire font-bold text-white border-none' : 'bg-white/5 text-gray-300 border-orange-500/30'} ${selectedTags.length >= 3 && !selectedTags.includes(tag) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            
            <div className="flex items-center space-x-2">
              <label className="block text-sm font-medium text-gray-300">
                Enable Sponsorship
              </label>
              <div 
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer ${sponsorshipEnabled ? 'bg-orange-500' : 'bg-white/10'}`}
                onClick={() => setSponsorshipEnabled(!sponsorshipEnabled)}
              >
                <div 
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${sponsorshipEnabled ? 'translate-x-6' : 'translate-x-0'}`} 
                />
              </div>
              <span className="text-sm text-gray-300">{sponsorshipEnabled ? 'On' : 'Off'}</span>
            </div>
          
          <div className="flex space-x-3 pt-2 pb-6">
            <DrawerClose asChild>
              <button
                type="button"
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Cancel
              </button>
            </DrawerClose>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 gradient-fire disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
