'use client'

import { useEffect, useRef } from 'react';
import { useHMSNotifications, useHMSActions, useHMSStore, selectLocalPeer } from '@100mslive/react-sdk';
import { HMSNotificationTypes } from '@100mslive/hms-video-store';
import { useParams } from 'next/navigation';

interface RoomCode {
  id: string;
  code: string;
  room_id: string;
  role: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export default function RoleChangeHandler() {
  const params = useParams();
  const roomId = params.id as string;
  const hmsActions = useHMSActions();
  const notification = useHMSNotifications();
  const localPeer = useHMSStore(selectLocalPeer);
  const isRejoining = useRef(false);
  const lastRole = useRef<string | null>(null);
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!notification) return;

    const handleRoleUpdate = async () => {
      if (notification.type === HMSNotificationTypes.ROLE_UPDATED) {
        const peer = notification.data;
        
        // Validate peer data
        if (!peer || !peer.roleName) {
          console.warn('[RoleChangeHandler] Invalid peer data in role update notification');
          return;
        }
        
        const newRole = peer.roleName;
        
        // Only handle local peer role changes
        if (peer.isLocal) {
          console.log(`[RoleChangeHandler] Local role changed from ${lastRole.current} to ${newRole}`);
          
          // Prevent infinite loops and invalid role changes
          if (isRejoining.current || lastRole.current === newRole || !newRole) {
            return;
          }

          // Validate that the new role is one we expect
          const validRoles = ['host', 'co-host', 'speaker', 'listener'];
          if (!validRoles.includes(newRole)) {
            console.warn(`[RoleChangeHandler] Unknown role: ${newRole}, skipping re-join`);
            return;
          }

          lastRole.current = newRole;
          isRejoining.current = true;

          try {
            console.log(`[RoleChangeHandler] Re-joining with new role: ${newRole}`);
            
            // Dispatch event to show re-joining state
            window.dispatchEvent(new CustomEvent('role_change_event', {
              detail: { type: 'role_change_start', newRole }
            }));
            
            // Get room codes for the new role
            const response = await fetch(`${URL}/api/rooms/public/${roomId}/codes`);
            const data = await response.json();

            if (!data.success) {
              throw new Error(data.error || 'Failed to fetch room codes');
            }

            const roomCodes: RoomCode[] = data.data.roomCodes;
            const roleCode = roomCodes.find(code => code.role === newRole);

            if (!roleCode) {
              throw new Error(`No room code found for role: ${newRole}`);
            }

            // Get auth token using the new role's room code
            const authToken = await hmsActions.getAuthTokenByRoomCode({
              roomCode: roleCode.code,
            });

            // Parse metadata if it exists
            let metadata: { avatar?: string; fid?: string } = {};
            try {
              if (peer.metadata) {
                metadata = JSON.parse(peer.metadata);
              }
            } catch (e) {
              console.warn('[RoleChangeHandler] Could not parse peer metadata:', e);
            }

            // Leave current room and re-join with new role
            await hmsActions.leave();
            
            // Small delay to ensure clean disconnect
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Re-join with new role
            await hmsActions.join({
              userName: peer.name || 'Anonymous',
              authToken,
              metaData: JSON.stringify({
                avatar: metadata.avatar || '',
                role: newRole,
                fid: metadata.fid || ''
              })
            });

            console.log(`[RoleChangeHandler] Successfully re-joined with role: ${newRole}`);
            
            // Dispatch event to show role change complete
            window.dispatchEvent(new CustomEvent('role_change_event', {
              detail: { type: 'role_change_complete', newRole }
            }));
          } catch (error) {
            console.error('[RoleChangeHandler] Error re-joining with new role:', error);
            
            // Dispatch event to show role change failed
            window.dispatchEvent(new CustomEvent('role_change_event', {
              detail: { type: 'role_change_failed', error: error instanceof Error ? error.message : 'Unknown error' }
            }));
          } finally {
            isRejoining.current = false;
          }
        }
      }
    };

    handleRoleUpdate();
  }, [notification, hmsActions, roomId]);

  // Handle messages for host transfer
  useEffect(() => {
    // Check if current notification is a new message
    if (notification?.type === HMSNotificationTypes.NEW_MESSAGE) {
      const data = notification.data;
      
      // Check if this is a host transfer reconnect message
      if (data && data.message === 'HOST_TRANSFER_RECONNECT') {
        console.log('[RoleChangeHandler] Received host transfer reconnect message');
        
        // We only want to reconnect if we're the peer that was promoted to host
        if (localPeer && localPeer.roleName === 'co-host') {
          console.log('[RoleChangeHandler] Co-host received reconnect message, initiating rejoin');
          
          // Force a page reload to properly reconnect with the new role
          window.location.reload();
        }
      }
    }
  }, [notification, localPeer]);

  // This component doesn't render anything
  return null;
}
