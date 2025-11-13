'use client'

import { useState, useRef, useEffect } from 'react';
import { useHMSActions, useHMSStore, selectLocalPeer, selectPermissions, selectIsPeerAudioEnabled } from '@100mslive/react-sdk';
import { ChevronDownIcon, MicOnIcon, MicOffIcon } from '@100mslive/react-icons';
import sdk from "@farcaster/miniapp-sdk";
import { updateParticipantRole, transferHostRole } from '@/utils/serverActions';

interface UserContextMenuProps {
  peer: any;
  isVisible: boolean;
  onClose: () => void;
  position: { x: number; y: number }; // We won't use this anymore
  onViewProfile?: () => void;
}

export default function UserContextMenu({ peer, isVisible, onClose, onViewProfile }: UserContextMenuProps) {
  const hmsActions = useHMSActions();
  const localPeer = useHMSStore(selectLocalPeer);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Add this hook to get peer audio state
  const permissions = useHMSStore(selectPermissions);
  const isPeerAudioEnabled = useHMSStore(selectIsPeerAudioEnabled(peer.id));
  const canRemoteMute = Boolean(permissions?.mute);          // depends on your template perms
  const canRemovePeer = Boolean(permissions?.removeOthers);  // depends on your template perms

  // Check if local user is host or co-host
  const isHostOrCoHost = localPeer?.roleName === 'host' || localPeer?.roleName === 'co-host';
  
  // Check if this is the local user
  const isLocalUser = peer.id === localPeer?.id;
  
  // Check if target peer is a host (to prevent co-hosts from accessing host's context menu)
  const isTargetPeerHost = peer.roleName === 'host';
  
  // Check if local user is co-host trying to access host's menu (not allowed)
  const isCoHostTryingToAccessHost = localPeer?.roleName === 'co-host' && isTargetPeerHost;

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
      
      // Change role in HMS
      await hmsActions.changeRoleOfPeer(peer.id, newRole, true);
      
      // Sync role change with Redis if we have user metadata
      try {
        const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
        const userFid = metadata?.fid;
        
        if (userFid) {
          // Get room ID from URL or context
          const pathParts = window.location.pathname.split('/');
          const roomId = pathParts[pathParts.length - 1];

          await updateParticipantRole(roomId, userFid, newRole, token);
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
      
      // For HMS SDK, we still need to update the local state
      // This should trigger when the webhook comes back, but we do it here for immediate UI feedback
      await hmsActions.changeRole(peer.id, 'host', true);
      await hmsActions.changeRole(localPeer.id, 'co-host', true);
      
      // Force a reconnection for the promoted user by sending a message
      try {
        await hmsActions.sendDirectMessage(
          'HOST_TRANSFER_RECONNECT', 
          peer.id
        );
        
      } catch (msgError) {
        console.error('Failed to send reconnect message:', msgError);
      }
      
      onClose();
    } catch (error) {
      console.error('Error transferring host role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMuteToggle = async () => {
    if (!peer.audioTrack || !canRemoteMute) return;
    try {
      await hmsActions.setRemoteTrackEnabled(peer.audioTrack, !isPeerAudioEnabled);
      onClose();
    } catch (err) {
      console.error('Remote mute failed:', err);
    }
  };

  const handleRemoveUser = async () => {
    if (!canRemovePeer) return;
    try {
      await hmsActions.removePeer(peer.id, 'Host removed you from the room!');
      onClose();
    } catch (err) {
      console.error('Remove peer failed:', err);
    }
  };

  const handleViewProfile = async () => {
    try {
      const metadata = peer.metadata ? JSON.parse(peer.metadata) : null;
      const userFid = metadata?.fid;
      
      if (userFid) {
        await sdk.actions.viewProfile({ 
          fid: parseInt(userFid)
        });
        onClose();
      } else {
        console.error('User FID not found in peer metadata');
      }
    } catch (error) {
      console.error('Error viewing profile:', error);
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
              onClick={handleViewProfile}
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
                <MicOnIcon className="w-5 h-5" />
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
                <ChevronDownIcon className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Changing...' : 'Make Co-host'}</span>
              </button>
            )}

            {/* Make Host - only when local user is host and peer is co-host */}
            {localPeer?.roleName === 'host' && currentRole === 'co-host' && (
              <button
                onClick={handleTransferHost}
                disabled={isLoading}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 transition-colors"
              >
                <ChevronDownIcon className="w-5 h-5" />
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
                <MicOnIcon className="w-5 h-5" />
                <span className="font-medium">{isLoading ? 'Changing...' : 'Make Listener'}</span>
              </button>
            )}

            {/* Mute - only show for speakers and co-hosts who are NOT muted */}
            {(currentRole === 'speaker' || currentRole === 'co-host') && canRemoteMute && peer.audioTrack && !isMuted && (
              <button
                onClick={handleMuteToggle}
                className="w-full px-6 py-3 text-left text-sm text-white hover:bg-gray-700 flex items-center space-x-3 transition-colors"
              >
                <MicOffIcon className="w-5 h-5" />
                <span className="font-medium">Mute</span>
              </button>
            )}

              {/* Remove User (only for host) */}
              {localPeer?.roleName === 'host' && canRemovePeer && (
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
