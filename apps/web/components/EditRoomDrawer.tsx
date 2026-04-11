'use client'

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { topics } from '@/utils/constants';
import sdk from "@farcaster/miniapp-sdk";
import { MdClose } from 'react-icons/md';
import { editRecurringRoom } from '@/utils/serverActions';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/UI/drawer";
import Button from './UI/Button';
import DateTimePicker from './UI/DateTimePicker';

interface Room {
  _id: string;
  name: string;
  description: string;
  host: {
    fid: string;
    username: string;
    displayName: string;
    pfp_url: string;
  };
  status: string;
  startTime: string;
  topics: string[];
  adsEnabled?: boolean;
  isRecurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | null;
  recurrenceDay?: number | null;
  recordingEnabled?: boolean;
}

interface EditRoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  onSuccess: () => void;
}

export default function EditRoomDrawer({ isOpen, onClose, room, onSuccess }: EditRoomDrawerProps) {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly'>('weekly');
  const [editScope, setEditScope] = useState<'this' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');

  // Pre-populate form when room changes
  useEffect(() => {
    if (isOpen && room) {
      setFormData({
        name: room.name || '',
        description: room.description || ''
      });
      setStartTime(room.startTime ? new Date(room.startTime) : null);
      setSelectedTags(room.topics || []);
      setAdsEnabled(room.adsEnabled ?? false);
      setRecordingEnabled(room.recordingEnabled ?? true);
      setIsRecurring(room.isRecurring ?? false);
      setRecurrenceType(room.recurrenceType || 'weekly');
      setEditScope('all');
      setNameError('');
    }
  }, [isOpen, room]);

  const handleSubmit = async () => {
    if (formData.name.trim() === '') {
      setNameError('Room name cannot be empty.');
      toast.error('Room name is required');
      return;
    }

    if (selectedTags.length === 0) {
      toast.error('Please select at least one topic tag.');
      return;
    }

    if (!startTime) {
      toast.error('Please select a start time.');
      return;
    }

    if (!room) return;

    setNameError('');
    setLoading(true);

    try {
      const env = process.env.NEXT_PUBLIC_ENV;
      let token: any = null;
      if (env !== "DEV") {
        token = (await sdk.quickAuth.getToken()).token;
      }

      const editData: any = {
        name: formData.name,
        description: formData.description,
        startTime: startTime.toISOString(),
        topics: selectedTags,
        adsEnabled,
        recordingEnabled,
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : null,
        editScope: room.isRecurring ? editScope : 'this',
      };

      const response = await editRecurringRoom(room._id, editData, token);

      if (response.ok && response.data.success) {
        toast.success('Room updated successfully!');
        onSuccess();
        onClose();
      } else {
        toast.error(response.data?.error || 'Failed to update room');
      }
    } catch (error) {
      console.error('Error updating room:', error);
      toast.error(error instanceof Error ? error.message : 'Error updating room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!room) return null;

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="bg-black/95 backdrop-blur-lg text-white gradient-orange-bg">
        <DrawerHeader className="border-b border-orange-500/30">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-2xl font-semibold text-white">Edit Room</DrawerTitle>
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
            {/* Room Name */}
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
                className={`w-full bg-white/10 text-white p-3 rounded-lg border ${nameError ? 'border-fireside-red' : 'border-orange-500/30'} focus:outline-none focus:border-orange-500 transition-colors text-base`}
                placeholder="Enter room name"
              />
              {nameError && <p className="text-fireside-red text-sm mt-1">{nameError}</p>}
            </div>

            {/* Description */}
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

            {/* Start Time */}
            <DateTimePicker
              label="Start Time"
              value={startTime}
              onChange={setStartTime}
              placeholder="Select start time"
              required
              minDate={new Date()}
            />

            {/* Recurring Toggle */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-300">
                  This is a regular show
                </label>
                <button
                  type="button"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`w-14 h-7 rounded-full p-1 flex items-center transition-colors ${isRecurring ? 'bg-fireside-orange' : 'bg-white/20'}`}
                >
                  <span
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${isRecurring ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>

              {isRecurring && (
                <div className="space-y-3 pl-2 border-l-2 border-orange-500/30">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Frequency
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setRecurrenceType('daily')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                          recurrenceType === 'daily'
                            ? 'bg-orange-500 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        Daily
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurrenceType('weekly')}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                          recurrenceType === 'weekly'
                            ? 'bg-orange-500 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        Weekly
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Edit Scope — only for recurring rooms */}
            {room.isRecurring && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Apply changes to
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditScope('this')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                      editScope === 'this'
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    This occurrence
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditScope('all')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm transition-colors ${
                      editScope === 'all'
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    All future shows
                  </button>
                </div>
              </div>
            )}

            {/* Topics */}
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
              {selectedTags.length === 0 && <p className="text-fireside-red text-sm mt-1">Please select at least one topic.</p>}
            </div>

            {/* Ads Toggle */}
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Enable ads for this room
                </label>
                <p className="text-xs text-gray-400">
                  Suitable ads will play automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdsEnabled(!adsEnabled)}
                className={`w-12 h-7 rounded-full p-1 flex items-center transition-colors ${adsEnabled ? 'bg-fireside-orange' : 'bg-white/20'}`}
              >
                <span
                  className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${adsEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Recording Toggle */}
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Record this room
                </label>
                <p className="text-xs text-gray-400">
                  Recording will be available after the room ends.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecordingEnabled(!recordingEnabled)}
                className={`w-12 h-7 rounded-full p-1 flex items-center transition-colors ${recordingEnabled ? 'bg-fireside-orange' : 'bg-white/20'}`}
              >
                <span
                  className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${recordingEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t border-orange-500/20">
          <div className="flex justify-between w-full">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-gray-300 w-[30%] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              disabled={loading}
              onClick={handleSubmit}
              className="gradient-fire rounded-lg w-[70%] ml-3 text-white font-medium"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
