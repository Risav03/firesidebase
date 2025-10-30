'use client'

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Mic, MicOff } from 'lucide-react';
import sdk from "@farcaster/miniapp-sdk";
import { updateParticipantRole, transferHostRole } from '@/utils/serverActions';
import { useRtmClient } from '@/utils/providers/rtm';

interface UserContextMenuProps {
  peer: any;
  isVisible: boolean;
  onClose: () => void;
  position: { x: number; y: number }; // We won't use this anymore
  onViewProfile?: () => void;
  meRole?: string;
}

export default function UserContextMenu({ peer, isVisible, onClose, onViewProfile, meRole }: UserContextMenuProps) {
  const localPeer: any = null;
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { channel } = useRtmClient();

  // Add this hook to get peer audio state
  const isPeerAudioEnabled = true;
  const canRemoteMute = true;          // permission is enforced server-side/RTM
  const canRemovePeer = true; 

  // Check if local user is host or co-host
  const isHostOrCoHost = meRole === 'host' || meRole === 'co-host';
  
  // Check if this is the local user
  const isLocalUser = (() => { try { return String(JSON.parse(peer?.metadata || '{}')?.fid || '') === String(JSON.parse(localStorage.getItem('fireside_user') || '{}')?.fid || ''); } catch { return false; } })();
  
  // Check if target peer is a host (to prevent co-hosts from accessing host's context menu)
  const isTargetPeerHost = peer.roleName === 'host';
  
  // Check if local user is co-host trying to access host's menu (not allowed)
  const isCoHostTryingToAccessHost = false;

  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    if (isVisible && !isCoHostTryingToAccessHost) {
      setIsOpen(true);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
  }, [isVisible, isCoHostTryingToAccessHost]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      // Restore body scroll when modal is not open
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Restore body scroll when component unmounts
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleRoleChange = async (newRole: string) => {
    const env = process.env.NEXT_PUBLIC_ENV;
        
    var token: any = "";
    if (env !== "DEV") {
      token = (await sdk.quickAuth.getToken()).token;
    };
    
    try {
      setIsLoading(true);
      
      // Sync role change with Redis if we have user metadata
      try {
        const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
        const userFid = metadata?.fid;
        
        if (userFid) {
          // Get room ID from URL or context
          const pathParts = window.location.pathname.split('/');
          const roomId = pathParts[pathParts.length - 1];

          await updateParticipantRole(roomId, userFid, newRole, token);
          // Broadcast role change over RTM so the target client updates
          try {
            await channel?.sendMessage({ text: JSON.stringify({ type: 'ROLE_CHANGE', payload: { userFid, newRole }, ts: Date.now() }) });
          } catch (e) {
            console.warn('RTM ROLE_CHANGE send failed', e);
          }
        }
      } catch (redisError) {
        console.error('Error syncing role with Redis:', redisError);
        // Don't fail the main operation if Redis sync fails
      }
      
      onClose();
    } catch (error) {
      console.error('Error changing role:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTransferHost = async () => {
    if (!localPeer) {
      console.error('Local peer not found');
      return;
    }
    
    try {
      setIsLoading(true);
      // Get room ID from URL
      const pathParts = window.location.pathname.split('/');
      const roomId = pathParts[pathParts.length - 1];
      
      // Extract FIDs from metadata
      const peerMetadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const peerFid = peerMetadata?.fid;
      
      let localFid = null;
      if (localPeer.metadata) {
        const localMetadata = JSON.parse(localPeer.metadata);
        localFid = localMetadata?.fid;
      }
      
      if (!peerFid || !localFid) {
        console.error('Missing user FIDs, cannot transfer host role');
        return;
      }
      
      // First promote the co-host to host using API
      const promoteResponse = await transferHostRole(roomId, peerFid, 'host');
      
      if (!promoteResponse.ok) {
        console.error('Failed to promote user to host');
        throw new Error('Failed to promote user to host');
      }
      
      // Then demote the current host to co-host
      const demoteResponse = await transferHostRole(roomId, localFid, 'co-host');
      
      if (!demoteResponse.ok) {
        console.error('Failed to demote current host to co-host');
        // Even if this fails, the other user is now host
      }
      
      // Notify peers via RTM so UIs can refresh
      try {
        const peerMetadata = peer.metadata ? JSON.parse(peer.metadata) : null;
        const promotedFid = peerMetadata?.fid;
        const localMetadata = localPeer?.metadata ? JSON.parse(localPeer.metadata) : null;
        const demotedFid = localMetadata?.fid;
        await channel?.sendMessage({ text: JSON.stringify({ type: 'HOST_TRANSFER', payload: { promotedFid, demotedFid }, ts: Date.now() }) });
      } catch {}
      
      onClose();
    } catch (error) {
      console.error('Error transferring host role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMuteToggle = async () => {
    if (!canRemoteMute) return;
    try {
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const userFid = metadata?.fid;
      if (userFid) {
        await channel?.sendMessage({ text: JSON.stringify({ type: 'REMOTE_MUTE', payload: { userFid }, ts: Date.now() }) });
      }
      onClose();
    } catch (err) {
      console.error('Remote mute failed:', err);
    }
  };

  const handleRemoveUser = async () => {
    if (!canRemovePeer) return;
    try {
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const userFid = metadata?.fid;
      if (userFid) {
        await channel?.sendMessage({ text: JSON.stringify({ type: 'REMOVE_PEER', payload: { userFid }, ts: Date.now() }) });
      }
      onClose();
    } catch (err) {
      console.error('Remove peer failed:', err);
    }
  };

  if (!isVisible || isLocalUser) {
    return null;
  }

  const currentRole = peer.roleName;
  const isMuted = !isPeerAudioEnabled;

  // Check if user has role management permissions
  const canManageRoles = isHostOrCoHost && !isCoHostTryingToAccessHost;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={menuRef}
          className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-sm mx-4 transform transition-all duration-200 ease-out"
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
          }}
        >
          {/* User Info Header */}
          <div className="px-6 py-4 border-b border-gray-600">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg font-medium">
                  {peer.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{peer.name}</p>
                <p className="text-gray-400 text-sm capitalize">{currentRole}</p>
              </div>
            </div>
          </div>

          {/* View Profile Option */}
          <div className="py-2">
            <button
              onClick={() => {
                onViewProfile?.();
                onClose();
              }}
              className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center space-x-3 transition-colors"
            >
              <span className="w-5 h-5">👤</span>
              <span className="font-medium">View Profile</span>
            </button>
          </div>

          {/* Role Management Options - Only show if user can manage roles */}
          {canManageRoles && (
            <div className="py-2 border-t border-gray-600">
              {/* Make Speaker */}
              {currentRole !== 'speaker' && (
              <button
                onClick={() => handleRoleChange('speaker')}
                disabled={isLoading}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
              >
                <Mic className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Changing...' : 'Make Speaker'}</span>
              </button>
            )}

            {/* Make Co-host */}
            {currentRole !== 'co-host' && (
              <button
                onClick={() => handleRoleChange('co-host')}
                disabled={isLoading}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Changing...' : 'Make Co-host'}</span>
              </button>
            )}

            {/* Make Host - only when local user is host and peer is co-host */}
            {false && currentRole === 'co-host' && (
              <button
                onClick={handleTransferHost}
                disabled={isLoading}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Transferring...' : 'Make Host'}</span>
              </button>
            )}

            {/* Make Listener */}
            {currentRole !== 'listener' && (
              <button
                onClick={() => handleRoleChange('listener')}
                disabled={isLoading}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
              >
                <Mic className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Changing...' : 'Make Listener'}</span>
              </button>
            )}

            {/* Mute - only show for speakers and co-hosts who are NOT muted */}
            {(currentRole === 'speaker' || currentRole === 'co-host') && canRemoteMute && !isMuted && (
              <button
                onClick={handleMuteToggle}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center space-x-3 transition-colors"
              >
                <MicOff className="w-5 h-5" />
                <span className="font-medium">Mute</span>
              </button>
            )}

              {/* Remove User (only for host) */}
              {canRemovePeer && (
                <div className="border-t border-gray-600 mt-2 pt-2">
                  <button
                    onClick={handleRemoveUser}
                    className="w-full px-6 py-3 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center space-x-3 transition-colors"
                  >
                    <span className="w-5 h-5">🚫</span>
                    <span className="font-medium">Remove User</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Close Button */}
          <div className="px-6 py-3 border-t border-gray-600">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-center text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
