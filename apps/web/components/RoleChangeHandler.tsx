'use client'

import { useEffect, useRef } from 'react';
import { useAgoraContext } from '@/contexts/AgoraContext';
import { useParams } from 'next/navigation';
import { fetchAPI } from '@/utils/serverActions';
import sdk from '@farcaster/miniapp-sdk';

export default function RoleChangeHandler() {
  const params = useParams();
  const roomId = params.id as string;
  const { localPeer, leave, join, onCustomEvent } = useAgoraContext();
  const isRejoining = useRef(false);
  const lastRole = useRef<string | null>(null);
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    // Listen for role change custom events
    const unsubscribe = onCustomEvent('ROLE_UPDATED', async (data: { targetFid: string; newRole: string }) => {
      if (!localPeer?.metadata) return;
      
      try {
        const metadata = JSON.parse(localPeer.metadata);
        
        // Only handle role changes for the local user
        if (String(metadata.fid) !== String(data.targetFid)) return;
        
        const newRole = data.newRole;

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
          // Dispatch event to show re-joining state
          window.dispatchEvent(new CustomEvent('role_change_event', {
            detail: { type: 'role_change_start', newRole }
          }));
          
          const env = process.env.NEXT_PUBLIC_ENV;
          let token: any = "";
          if (env !== "DEV") {
            token = (await sdk.quickAuth.getToken()).token;
          }

          // Fetch new Agora token for the updated role
          const response = await fetchAPI(
            `${URL}/api/rooms/protected/${roomId}/my-code`,
            { authToken: token }
          );

          if (!response.ok || !response.data.success) {
            throw new Error(response.data.error || 'Failed to fetch new token');
          }

          const { role, token: agoraToken, channelName, uid, appId } = response.data.data;

          // Leave current channel
          await leave();
          
          // Small delay to ensure clean disconnect
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Re-join with new role
          await join(
            appId,
            channelName,
            agoraToken,
            uid,
            role,
            JSON.stringify({
              avatar: metadata.avatar || '',
              role: role,
              fid: metadata.fid || '',
              wallet: metadata.wallet || '0x1ce256752fBa067675F09291d12A1f069f34f5e8',
            })
          );
          
          // Dispatch event to show role change complete
          window.dispatchEvent(new CustomEvent('role_change_event', {
            detail: { type: 'role_change_complete', newRole: role }
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
      } catch (e) {
        console.error('[RoleChangeHandler] Error parsing metadata:', e);
      }
    });

    return unsubscribe;
  }, [localPeer, leave, join, onCustomEvent, roomId, URL]);

  // This component doesn't render anything
  return null;
}