'use client'

import { useState, useEffect } from 'react';
import { useNavigateWithLoader } from '@/utils/useNavigateWithLoader';
import { useGlobalContext } from '@/utils/providers/globalContext';
import { toast } from 'react-toastify';
import { topics } from '@/utils/constants';
import sdk from "@farcaster/miniapp-sdk";
import { MdClose } from 'react-icons/md';
import { createRoom } from '@/utils/serverActions';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";
import Button from './UI/Button';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getCurrentLocalDateTime = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localISOTime = new Date(now.getTime() - offset).toISOString();
  return localISOTime.slice(0, 16);
};

const convertLocalDateTimeToUTC = (localDateTime: string) => {
  return new Date(localDateTime);
};

export default function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: getCurrentLocalDateTime()
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sponsorshipEnabled, setSponsorshipEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const navigate = useNavigateWithLoader();
  const { user } = useGlobalContext();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        startTime: getCurrentLocalDateTime()
      });
      setSelectedTags([]);
      setSponsorshipEnabled(false);
      setNameError('');
    }
  }, [isOpen]);

  const createRoomHandler = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (formData.name.trim() === '') {
      setNameError('Room name cannot be empty.');
      toast.error('Room name is required');
      return;
    }

    if (selectedTags.length === 0) {
      toast.error('Please select at least one topic tag.');
      return;
    }
    
    setNameError('');
    setLoading(true);
    
    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      let token: any = null;
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      const roomData = {
        ...formData,
        startTime: convertLocalDateTimeToUTC(formData.startTime).toISOString(),
        host: user?.fid || '',
        topics: selectedTags,
        sponsorshipEnabled
      };

      const response = await createRoom(roomData, token);      
      
      if (response.data.success) {
        toast.success('Room created successfully!');
        setFormData({ name: '', description: '', startTime: getCurrentLocalDateTime() });
        setSelectedTags([]);
        setSponsorshipEnabled(false);
        onClose();

        const roomStartTime = convertLocalDateTimeToUTC(formData.startTime);
        const now = new Date();
        
        if (now >= roomStartTime) {
          navigate('/call/' + response.data.data._id);
        } else {
          window?.location.reload();
        }
      } else {
        toast.error('Error creating room: ' + response.data.error);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Error creating room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const scheduleRoom = () => {
    const oneHourLater = new Date();
    oneHourLater.setHours(oneHourLater.getHours() + 1);
    const offset = oneHourLater.getTimezoneOffset() * 60000;
    const localISOTime = new Date(oneHourLater.getTime() - offset).toISOString().slice(0, 16);
    
    const scheduledTime = prompt(`Schedule room for when? (Format: ${localISOTime})`, localISOTime);
    if (!scheduledTime) return;

    const selectedTime = convertLocalDateTimeToUTC(scheduledTime);
    if (selectedTime < new Date()) {
      toast.error('Start time cannot be in the past');
      return;
    }

    setFormData({ ...formData, startTime: scheduledTime });
    createRoomHandler();
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose} disablePreventScroll>
      <DrawerContent className="bg-black/95 backdrop-blur-lg text-white border-orange-500/30 ">
        <DrawerHeader className="border-b border-orange-500/30">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-2xl font-semibold text-white">Create New Room</DrawerTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2"
              aria-label="Close"
            >
              <MdClose size={24} />
            </button>
          </div>
        </DrawerHeader>
        
        <div className="px-4 py-6 max-h-[90vh] overflow-y-auto">
          <div className="max-w-lg mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Room Name*
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setNameError(e.target.value.trim() === '' ? 'Room name cannot be empty.' : '');
                }}
                className={`w-full bg-white/10 text-white p-3 rounded-lg border ${nameError ? 'border-red-500' : 'border-orange-500/30'} focus:outline-none focus:border-orange-500 transition-colors text-base`}
                placeholder="Enter room name"
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
                className="w-full bg-white/10 text-white p-3 rounded-lg border border-orange-500/30 focus:outline-none focus:border-orange-500 transition-colors text-base min-h-[80px]"
                rows={3}
                placeholder="Describe your room (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Topics (up to 3)*
              </label>
              <div className="flex flex-wrap gap-2">
                {topics.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      } else if (selectedTags.length < 3) {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {selectedTags.length === 0 && <p className="text-red-500 text-sm mt-1">Please select at least one topic.</p>}
              {selectedTags.length > 3 && <p className="text-red-500 text-sm mt-1">You can select up to 3 topics only.</p>}
            </div>
            
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-300">
                Enable Sponsorship
              </label>
              <div 
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${sponsorshipEnabled ? 'bg-orange-500' : 'bg-white/10'}`}
                onClick={() => setSponsorshipEnabled(!sponsorshipEnabled)}
              >
                <div 
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${sponsorshipEnabled ? 'translate-x-6' : 'translate-x-0'}`} 
                />
              </div>
            </div>
          </div>
        </div>
        
        <DrawerFooter className="border-t border-orange-500/20">
          <div className="flex gap-2">
            <Button
              disabled={loading}
              onClick={createRoomHandler}
              className="gradient-fire flex-1 text-white font-medium"
            >
              {loading ? 'Igniting...' : 'Fire up!'}
            </Button>
            <Button
              variant="ghost"
              onClick={scheduleRoom}
              className="text-gray-300 hover:text-white"
            >
              📅
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}