'use client'

/**
 * AvatarContextMenuRTK - RealtimeKit version of AvatarContextMenu
 * 
 * Key changes from 100ms version:
 * - Uses useLocalParticipant() instead of selectLocalPeer
 * - Uses useParticipantActions() for mute/kick operations
 * - Uses useStageManagement() for stage operations
 * - Uses participant.disableAudio() for muting
 * - Uses participant.kick() for removal
 * - Uses stage.grantAccess([userId]) for speaker promotion
 * - Uses stage.kick([userId]) for listener demotion
 * 
 * Note: Stage APIs use userId (persistent), not id (session)
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRealtimeKit } from '@/utils/providers/realtimekit';
import { 
  useLocalParticipant,
  useParticipantActions,
  useStageManagement,
  getParticipantRole,
  isHostOrCohost,
  canMuteOthers,
  canKickParticipants,
  type RealtimeKitParticipant
} from '@/utils/providers/realtimekit-hooks';
import sdk from '@farcaster/miniapp-sdk';
import { toast } from 'react-toastify';
import Modal from '@/components/UI/Modal';
import { updateParticipantRole, transferHostRole } from '@/utils/serverActions';
import Image from 'next/image';

interface AvatarContextMenuRTKProps {
  peer: RealtimeKitParticipant;
  isVisible: boolean;
  onClose: () => void;
  onOpenTipDrawer?: () => void;
}

export default function AvatarContextMenuRTK({ peer, isVisible, onClose, onOpenTipDrawer }: AvatarContextMenuRTKProps) {
  const { meeting } = useRealtimeKit();
  const localParticipant = useLocalParticipant(meeting);
  const { muteParticipant, kickParticipant } = useParticipantActions(meeting);
  const { acceptStageRequest, removeFromStage } = useStageManagement(meeting);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Permissions
  const canMute = canMuteOthers(meeting);
  const canKick = canKickParticipants(meeting);

  // Role checks
  const localRole = localParticipant ? getParticipantRole(localParticipant) : 'listener';
  const peerRole = getParticipantRole(peer);
  const isLocalHostOrCohost = isHostOrCohost(localParticipant as any);
  const isLocalUser = peer.id === localParticipant?.id;
  const isTargetPeerHost = peerRole === 'host';
  const isCoHostTryingToAccessHost = localRole === 'co-host' && isTargetPeerHost;

  // Get peer metadata
  const getPeerMetadata = () => {
    try {
      if (peer.metadata) {
        return JSON.parse(peer.metadata);
      }
    } catch (e) {}
    return {};
  };

  const peerMetadata = getPeerMetadata();
  const isPeerAudioEnabled = peer.audioEnabled;
  const isMuted = !isPeerAudioEnabled;
  const canManageRoles = isLocalHostOrCohost && !isCoHostTryingToAccessHost;

  useEffect(() => {
    if (isVisible && !isCoHostTryingToAccessHost && !isLocalUser) {
      setIsOpen(true);
      document.body.style.overflow = 'hidden';
    } else {
      setIsOpen(false);
      document.body.style.overflow = 'unset';
    }
  }, [isVisible, isCoHostTryingToAccessHost, isLocalUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  /**
   * Handle role change using Stage Management
   * 
   * For speaker promotion: grantAccess([userId])
   * For listener demotion: kick([userId]) from stage
   */
  const handleRoleChange = async (newRole: string) => {
    const env = process.env.NEXT_PUBLIC_ENV;
    let token = "";
    if (env !== "DEV") {
      token = (await sdk.quickAuth.getToken()).token;
    }
    
    try {
      setIsLoading(true);
      
      // Use userId for Stage APIs
      const targetUserId = peer.userId;
      
      if (newRole === 'speaker') {
        // Promote to speaker using Stage Management
        await acceptStageRequest([targetUserId]);
      } else if (newRole === 'listener') {
        // Demote to listener using Stage Management
        await removeFromStage([targetUserId]);
      }
      // Note: co-host and host changes need backend REST API (Phase 9)
      
      // Sync role change with Redis
      try {
        const userFid = peerMetadata?.fid;
        if (userFid) {
          const pathParts = window.location.pathname.split('/');
          const roomId = pathParts[pathParts.length - 1];
          await updateParticipantRole(roomId, userFid, newRole, token);
        }
      } catch (redisError) {
        console.error('Error syncing role with Redis:', redisError);
      }
      
      toast.success(`Changed ${peer.name}'s role to ${newRole}`);
      onClose();
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error('Failed to change role');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle host transfer - this needs backend API support
   * For now, we'll sync with Redis and handle via backend
   */
  const handleTransferHost = async () => {
    if (!localParticipant) {
      console.error('Local participant not found');
      return;
    }
    
    try {
      setIsLoading(true);
      const pathParts = window.location.pathname.split('/');
      const roomId = pathParts[pathParts.length - 1];
      
      const peerFid = peerMetadata?.fid;
      const localMetadata = localParticipant.metadata ? JSON.parse(localParticipant.metadata) : {};
      const localFid = localMetadata?.fid;
      
      if (!peerFid || !localFid) {
        console.error('Missing user FIDs, cannot transfer host role');
        toast.error('Missing user information for host transfer');
        return;
      }
      
      // Use backend API for host transfer
      const promoteResponse = await transferHostRole(roomId, peerFid, 'host');
      
      if (!promoteResponse.ok) {
        throw new Error('Failed to promote user to host');
      }
      
      const demoteResponse = await transferHostRole(roomId, localFid, 'co-host');
      
      if (!demoteResponse.ok) {
        console.error('Failed to demote current host to co-host');
      }
      
      toast.success('Host role transferred successfully');
      onClose();
      
      // Note: Preset/role changes in RealtimeKit need REST API (Phase 9)
      
    } catch (error) {
      console.error('Error transferring host role:', error);
      toast.error('Failed to transfer host role');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Mute participant using participant.disableAudio()
   */
  const handleMuteToggle = async () => {
    if (!canMute) return;
    try {
      await muteParticipant(peer.id);
      toast.success(`Muted ${peer.name}`);
      onClose();
    } catch (err) {
      console.error('Remote mute failed:', err);
      toast.error('Failed to mute user');
    }
  };

  /**
   * Remove user using participant.kick()
   */
  const handleRemoveUser = async () => {
    if (!canKick) {
      toast.error('You do not have permission to remove users');
      return;
    }
    try {
      await kickParticipant(peer.id);
      toast.success(`${peer.name} has been removed from the room`);
      onClose();
    } catch (err) {
      console.error('Remove peer failed:', err);
      toast.error('Failed to remove user from room');
    }
  };

  const handleViewProfile = async () => {
    try {
      const userFid = peerMetadata?.fid;
      
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

  if (isLocalUser) {
    return null;
  }

  const modalContent = (
    <Modal
      isOpen={isVisible}
      onClose={onClose}
      className="bg-[#000000] gradient-yellow-bg rounded-xl shadow-2xl border-white/5 p-0"
      showCloseButton={false}
    >
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-700">
            {peerMetadata.avatar || peer.picture ? (
              <Image 
                unoptimized 
                src={peerMetadata.avatar || peer.picture} 
                alt={`${peer.name}'s avatar`} 
                width={48} 
                height={48} 
                className="rounded-full w-full h-full object-cover" 
              />
            ) : (
              <span className="text-white text-lg font-medium flex items-center justify-center w-full h-full bg-blue-600">
                {peer.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-white font-medium text-lg">{peer.name}</h3>
            <p className="text-gray-400 text-sm capitalize">{peerRole}</p>
          </div>
        </div>
      </div>

      <div className="p-2">
        <button
          onClick={handleViewProfile}
          className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>View Profile</span>
        </button>

        {canManageRoles && (
          <>
            {peerRole === 'listener' && (
              <button
                onClick={() => handleRoleChange('speaker')}
                disabled={isLoading}
                className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Promoting...' : 'Promote to Speaker'}
              </button>
            )}
            
            {peerRole === 'speaker' && (
              <>
                {/* Note: Co-host promotion needs backend API (Phase 9) */}
                <button
                  onClick={() => handleRoleChange('listener')}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Demoting...' : 'Demote to Listener'}
                </button>
              </>
            )}
            
            {peerRole === 'co-host' && localRole === 'host' && (
              <>
                <button
                  onClick={handleTransferHost}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Transferring...' : 'Transfer Host Role'}
                </button>
                <button
                  onClick={() => handleRoleChange('speaker')}
                  disabled={isLoading}
                  className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Demoting...' : 'Demote to Speaker'}
                </button>
              </>
            )}
            
            {canMute && peerRole !== 'listener' && !isMuted && (
              <button
                onClick={handleMuteToggle}
                className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors"
              >
                Mute
              </button>
            )}
            
            {canKick && (
              <button
                onClick={handleRemoveUser}
                className="w-full text-left px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Remove from Room
              </button>
            )}
          </>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenTipDrawer) {
              onOpenTipDrawer();
            }
          }}
          className="w-full text-left px-4 py-3 text-white hover:bg-gray-800/50 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>Send Tip</span>
        </button>
      </div>
    </Modal>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

