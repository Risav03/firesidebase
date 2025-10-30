'use client'

import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { fetchRoomCodes } from '@/utils/serverActions';
import { useRtmClient } from '@/utils/providers/rtm';

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
  const localPeer: any = null;
  const isRejoining = useRef(false);
  const lastRole = useRef<string | null>(null);
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const { channel } = useRtmClient();

  useEffect(() => {
    if (!channel) return;
    const handler = ({ text }: any) => {
      try {
        const data = JSON.parse(text);
        if (data?.type === 'ROLE_CHANGE') {
          const targetFid = String(data?.payload?.userFid || '');
          const newRole = String(data?.payload?.newRole || '');
          const validRoles = ['host', 'co-host', 'speaker', 'listener'];
          if (!validRoles.includes(newRole)) return;
          const localFid = (() => {
            try { return JSON.parse(localStorage.getItem('fireside_user') || '{}')?.fid || ''; } catch { return ''; }
          })();
          if (String(localFid) === targetFid) {
            if (isRejoining.current || lastRole.current === newRole) return;
            lastRole.current = newRole;
            // Dispatch events for UI to update role-dependent states
            window.dispatchEvent(new CustomEvent('role_change_event', { detail: { type: 'role_change_start', newRole } }));
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('role_change_event', { detail: { type: 'role_change_complete', newRole } }));
            }, 500);
          }
        } else if (data?.type === 'HOST_TRANSFER') {
          // Optional: refresh UI for host transfer flows if needed
          window.dispatchEvent(new CustomEvent('role_change_event', { detail: { type: 'role_change_complete' } }));
        }
      } catch {}
    };
    channel.on('ChannelMessage', handler);
    return () => {
      try { channel.off('ChannelMessage', handler); } catch {}
    };
  }, [channel, localPeer]);

  // Host transfer is handled via RTM listener above

  // This component doesn't render anything
  return null;
}
