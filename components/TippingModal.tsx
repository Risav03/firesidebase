import { useState, useEffect, useRef } from 'react';
import { useGlobalContext } from '@/utils/providers/globalContext';

interface TippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

interface Participant {
  userId: string;
  username: string;
  pfp_url: string;
  customDomain?: string;
  status: string;
}

export default function TippingModal({ isOpen, onClose, roomId }: TippingModalProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customTip, setCustomTip] = useState<string>('');
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetch(`/api/rooms/${roomId}/participants`)
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            const activeParticipants = data.participants.filter(
              (participant: Participant) => participant.status === 'active'
            );
            setParticipants(activeParticipants);
          }
        })
        .catch((error) => console.error('Error fetching participants:', error));
    }
  }, [isOpen, roomId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleTip = () => {
    if (selectedUsers.length === 0) return;
    alert(`Tipped ${selectedUsers.join(', ')}!`);
    onClose();
  };

  const handleRoleSelection = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles((prev) => prev.filter((r) => r !== role));
    } else {
      setSelectedRoles((prev) => [...prev, role]);
    }
    setSelectedUsers([]); // Clear user selection when roles are selected
  };

  const handleUserSelection = (username: string) => {
    if (selectedUsers.includes(username)) {
      setSelectedUsers((prev) => prev.filter((user) => user !== username));
    } else {
      setSelectedUsers((prev) => [...prev, username]);
    }
    setSelectedRoles([]); // Clear role selection when users are selected
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Send a Tip</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Select multiple roles</label>
          <div className="flex space-x-2">
            {['host', 'co-host', 'speaker', 'listener'].map((role) => (
              <button
                key={role}
                onClick={() => handleRoleSelection(role)}
                className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${selectedRoles.includes(role) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div className='w-full flex items-center justify-center text-white'> -- OR -- </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Select multiple users</label>
          <div ref={dropdownRef} className="relative">
            <div
              className="bg-gray-700 border border-gray-600 rounded-md text-white p-2 cursor-pointer"
              onClick={() => setDropdownOpen((prev) => !prev)}
            >
              {selectedUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((username) => (
                    <div key={username} className="flex items-center bg-gray-600 rounded-md px-2 py-1">
                      <img
                        src={participants.find((p) => p.username === username)?.pfp_url || '/default-avatar.png'}
                        alt={username}
                        className="w-6 h-6 rounded-full border border-gray-600 mr-2"
                      />
                      <span>{username}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span>Choose users</span>
              )}
            </div>

            {dropdownOpen && (
              <div className="absolute top-full left-0 w-full bg-gray-700 border border-gray-600 rounded-md max-h-60 overflow-y-auto">
                <div className="p-2">
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="w-full bg-gray-600 text-white p-2 rounded-md border border-gray-500 focus:outline-none"
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {participants
                  .filter((participant) =>
                    participant.username.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((participant) => (
                    <div
                      key={participant.userId}
                      className={`flex items-center p-2 cursor-pointer hover:bg-gray-600 ${selectedUsers.includes(participant.username) ? 'bg-gray-600' : ''}`}
                      onClick={() => handleUserSelection(participant.username)}
                    >
                      <img
                        src={participant.pfp_url || '/default-avatar.png'}
                        alt={participant.username}
                        className="w-10 h-10 rounded-full border border-gray-600 mr-3"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{participant.username}</p>
                        <p className="text-xs text-gray-400">{participant.customDomain || 'No domain'}</p>
                      </div>
                      {selectedUsers.includes(participant.username) && (
                        <svg
                          className="w-5 h-5 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 w-full">
          <label className="text-sm block font-medium text-gray-300 mb-2">Select Tip Amount</label>
          <div className="flex space-x-2 w-full">
            {[10, 25, 100].map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  setSelectedTip(amount);
                  setCustomTip('');
                }}
                className={`px-4 py-2 rounded-md text-white font-medium transition-colors w-1/3 ${selectedTip === amount ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              >
                ${amount}
              </button>
            ))}
            
          </div>
          <label className="text-sm block font-medium text-gray-300 mt-4 mb-2">Add Custom Tip Amount</label>

          <input
              type="number"
              placeholder="Custom"
              value={customTip}
              onChange={(e) => {
                setCustomTip(e.target.value);
                setSelectedTip(null);
              }}
              className="px-4 py-2 rounded-md text-white bg-gray-600 border w-full border-gray-500 focus:outline-none"
            />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleTip}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Send Tip
          </button>
        </div>
      </div>
    </div>
  );
}
