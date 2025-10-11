'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigateWithLoader } from '@/utils/useNavigateWithLoader';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { toast } from 'react-toastify';
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

// Helper function to get current date/time in user's timezone for datetime-local input
const getCurrentLocalDateTime = () => {
  const now = new Date();
  // Get timezone offset and adjust for local time
  const offset = now.getTimezoneOffset() * 60000;
  const localISOTime = new Date(now.getTime() - offset).toISOString();
  return localISOTime.slice(0, 16);
};

// Helper function to convert datetime-local input to proper Date object
const convertLocalDateTimeToUTC = (localDateTime: string) => {
  // Create date object from local datetime string (this treats it as local time)
  return new Date(localDateTime);
};

export default function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: getCurrentLocalDateTime() // Initialize with current local time
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sponsorshipEnabled, setSponsorshipEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const navigate = useNavigateWithLoader();
  const { user } = useGlobalContext();
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  
  // Refs for input elements and drawer
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Mobile keyboard detection and viewport management
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const fullHeight = window.screen.height;
      
      setViewportHeight(currentHeight);
      
      // Detect if keyboard is visible (viewport height significantly reduced)
      const keyboardThreshold = fullHeight * 0.75;
      setIsKeyboardVisible(currentHeight < keyboardThreshold);
    };

    // Initial setup
    handleViewportChange();

    // Listen for viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    } else {
      window.addEventListener('resize', handleViewportChange);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);

  // Cleanup toasts when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Dismiss any lingering toasts when modal closes
      const timeoutId = setTimeout(() => {
        toast.dismiss();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        startTime: getCurrentLocalDateTime() // Reset to current time when modal opens
      });
      setSelectedTags([]);
      setSponsorshipEnabled(false);
      setNameError('');
    }
  }, [isOpen]);

  // Handle input focus for mobile
  const handleInputFocus = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // Small delay to ensure keyboard is fully visible
    setTimeout(() => {
      if (drawerContentRef.current) {
        // Scroll the drawer content to ensure input is visible
        drawerContentRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest'
        });
      }
    }, 300);
  }, []);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    // Reset any scroll adjustments when keyboard closes
    setTimeout(() => {
      if (drawerContentRef.current) {
        drawerContentRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, []);

  const createRoomHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    // Allow all characters in room name
    if (formData.name.trim() === '') {
      setNameError('Room name cannot be empty.');
      toast.error('Room name is required', {
        autoClose: 3000,
        toastId: `room-name-error-${Date.now()}`
      });
      return;
    }
    
    // Validate start time is not in the past
    const selectedTime = convertLocalDateTimeToUTC(formData.startTime);
    const now = new Date();
    
    if (selectedTime < now) {
      toast.error('Start time cannot be in the past', {
        autoClose: 3000,
        toastId: `time-error-${Date.now()}`
      });
      return;
    }
    
    setNameError('');
    setLoading(true);

      if (selectedTags.length === 0) {
        toast.error('Please select at least one topic tag.', {
          autoClose: 3000,
          toastId: `topic-error-${Date.now()}`
        });
        setLoading(false);
        return;
      }
    
    try {
      // Create a loading toast and store its ID
      const loadingToastId = toast.loading('Creating room...');
      const env = process.env.NEXT_PUBLIC_ENV;

      let token: any = null;
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      // Convert local datetime to proper Date object for backend
      const roomData = {
        ...formData,
        startTime: convertLocalDateTimeToUTC(formData.startTime).toISOString(), // Send as ISO string to backend
        host: user?.fid || '',
        topics: selectedTags,
        sponsorshipEnabled
      };

      const response = await createRoom(roomData, token);      
      
      if (response.data.success) {
        // Dismiss the specific loading toast and show success
        toast.dismiss(loadingToastId);
        setTimeout(() => {
          toast.success('Room created successfully! Redirecting...', {
            autoClose: 3000,
            toastId: `room-created-${Date.now()}`
          });
        }, 50);
        setFormData({ name: '', description: '', startTime: getCurrentLocalDateTime() });
        setSelectedTags([]);
        setSponsorshipEnabled(false);
        onClose();
        // Redirect to the room page

        //if current time is less than start time, dont navigate
        if (new Date() <= new Date(formData.startTime)) {
          navigate('/call/' + response.data.data._id);
        }
      } else {
        // Dismiss the specific loading toast and show error
        toast.dismiss(loadingToastId);
        setTimeout(() => {
          toast.error('Error creating room: ' + response.data.error, {
            autoClose: 4000,
            toastId: `room-error-${Date.now()}`
          });
        }, 50);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      // Dismiss all toasts and show error
      toast.dismiss();
      setTimeout(() => {
        toast.error('Error creating room. Please try again.', {
          autoClose: 4000,
          toastId: `room-error-catch-${Date.now()}`
        });
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent 
        ref={drawerContentRef}
        className={`bg-black/90 backdrop-blur-lg border-t border-orange-500/50 text-white p-4 transition-all duration-300 ${
          isKeyboardVisible ? 'mobile-keyboard-active' : ''
        }`}
        style={{
          maxHeight: isKeyboardVisible && viewportHeight > 0 
            ? `${viewportHeight}px` 
            : undefined,
          transform: isKeyboardVisible 
            ? 'translateY(0)' 
            : undefined
        }}
      >
      
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-semibold text-white text-center">Create New Room</DrawerTitle>
        </DrawerHeader>
        
        <form onSubmit={createRoomHandler} className="space-y-2 px-4">
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
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
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
              ref={descriptionTextareaRef}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full bg-white/10 text-white p-2 rounded-lg border border-orange-500/30 focus:outline-none focus:border-orange-500 transition-colors h-16"
              rows={3}
            />
          </div>
          
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Start Time* (Your Local Time)
            </label>
            <input
              type="datetime-local"
              value={formData.startTime}
              min={getCurrentLocalDateTime()} // Prevent selecting past times
              onChange={(e) => setFormData({...formData, startTime: e.target.value})}
              className="w-full px-3 py-2 bg-white/10 border border-orange-500/30 rounded-lg text-white focus:outline-none focus:border-orange-500 transition-colors [color-scheme:dark]"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>
         

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