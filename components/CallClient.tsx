"use client";

import { useEffect, useRef, useState } from "react";
import { useRtmClient } from "@/utils/providers/rtm";
import { useGlobalContext } from "@/utils/providers/globalContext";
import Conference from "@/components/Conference";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RoleChangeHandler from "@/components/RoleChangeHandler";
import { Loader } from "@/components/Loader";
import { toast } from "react-toastify";
import sdk from "@farcaster/miniapp-sdk";
import { useNavigateWithLoader } from "@/utils/useNavigateWithLoader";
import { fetchAPI, fetchRoomParticipants, addParticipantToRoom, removeParticipantFromRoom, getAgoraRtcToken, getAgoraRtmToken, endProtectedRoom } from "@/utils/serverActions";

interface RoomCode {
  id: string;
  code: string;
  room_id: string;
  role: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface CallClientProps { roomId: string; }

export default function CallClient({ roomId }: CallClientProps) {
  const URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const { user } = useGlobalContext();
  const { client: rtmClient, channel, setChannel } = useRtmClient();

  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const joiningRef = useRef(false);
  const rtcClientRef = useRef<any>(null);
  const micTrackRef = useRef<any>(null);
  const appIdRef = useRef<string>(process.env.NEXT_PUBLIC_AGORA_APP_ID || '');
  const joinedRef = useRef<boolean>(false);
  const roleRef = useRef<string>('listener');
  const rtmTokenRef = useRef<string | null>(null);
  const rtcUidRef = useRef<string>('');
  const rtmUidRef = useRef<string>('');
  const rtmLoggedInRef = useRef<boolean>(false);
  const joinSeqRef = useRef<number>(0);
  const [participantAdded, setParticipantAdded] = useState(false);
  const [rtmReady, setRtmReady] = useState(false);

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  useEffect(() => {
    const joinRoom = async () => {
      try {
        if (joiningRef.current) return; // guard against strict mode double-invoke
        joiningRef.current = true;
        let token: string | null = null;
        const isDev = process.env.NEXT_PUBLIC_ENV === 'DEV';
        if (!isDev) {
          try { token = (await sdk.quickAuth.getToken()).token; } catch {}
        }

        if (!user) {
          setError("User not authenticated");
          setIsJoining(false);
          return;
        }

        let role = "listener";

        const roomResponse = await fetchAPI(`${URL}/api/rooms/public/${roomId}`);
        if (roomResponse.ok) {
          const hostObj = roomResponse.data?.data?.room?.host || {};
          const hostMongoId = String(hostObj?._id || '');
          const hostFid = String(hostObj?.fid || '');
          const hostUsername = String(hostObj?.username || '');
          const myMongoId = String(user?._id || '');
          const myFid = String(user?.fid || '');
          const myUsername = String(user?.username || '');
          if (
            (hostMongoId && hostMongoId === myMongoId) ||
            (hostFid && hostFid === myFid) ||
            (hostUsername && hostUsername === myUsername)
          ) {
            role = 'host';
          }
        }
        if (role !== 'host') {
          try {
            const parts = await fetchRoomParticipants(roomId);
            if (parts.ok && parts.data?.data?.participants?.length) {
              const me = parts.data.data.participants.find((p: any) => {
                const pid = String(p.userId || p.username || p.userFid || '');
                return pid === String(user.fid) || pid === String(user.username) || pid === String(user._id);
              });
              if (me?.role) role = me.role;
            }
          } catch {}
        }
        roleRef.current = role;
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(`fireside_role_${roomId}`, role);
          }
        } catch {}

        // Use a per-session Agora userAccount to avoid UID_CONFLICT ghost sessions
        if (!rtcUidRef.current) {
          const base = String(user.username);
          const suffix = Date.now().toString(36);
          rtcUidRef.current = `${base}:${suffix}`; // per-session userAccount (ASCII, <=255)
        }
        const rtcUid = rtcUidRef.current; // string userAccount
        // RTM uses the same userAccount for alignment
        rtmUidRef.current = rtcUidRef.current;
        const tokenRole = ['host','co-host','speaker'].includes(role) ? 'publisher' : 'subscriber';
        let rtcRes = await getAgoraRtcToken({ channel: roomId, uid: rtcUid, role: tokenRole as 'publisher' | 'subscriber' }, token || null);
        const rtmRes = await getAgoraRtmToken({ uid: rtmUidRef.current }, token || null);
        if (!rtcRes.ok && String(rtcRes?.data?.error || '').toLowerCase().includes('insufficient permissions')) {
          // fallback to subscriber if backend denies publisher
          rtcRes = await getAgoraRtcToken({ channel: roomId, uid: rtcUid, role: 'subscriber' }, token || null);
        }
        if (!rtcRes.ok || !rtmRes.ok) throw new Error('Failed to get Agora tokens');
        const rtcToken = rtcRes.data?.result?.token || rtcRes.data?.data?.token || rtcRes.data?.token;
        const rtmToken = rtmRes.data?.result?.token || rtmRes.data?.data?.token || rtmRes.data?.token;
        if (!rtcToken || !rtmToken) throw new Error('Missing RTC/RTM token');
        rtmTokenRef.current = rtmToken;

        const { default: AgoraRTC } = await import('agora-rtc-sdk-ng');
        const appId = appIdRef.current;
        if (!appId) throw new Error('Missing NEXT_PUBLIC_AGORA_APP_ID');

        // Ensure any stale client is fully left before joining
        try { await rtcClientRef.current?.leave?.(); } catch {}

        const makeClient = () => { rtcClientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }); };
        makeClient();
        joinSeqRef.current += 1;
        const seq = joinSeqRef.current;

        const attemptJoin = async (attempt: number): Promise<void> => {
          if (joinedRef.current || seq !== joinSeqRef.current) return;
          try {
            const client = rtcClientRef.current;
            await client.join(appId, roomId, rtcToken, rtcUid);
          } catch (e: any) {
            const msg = String(e?.message || e);
            if (msg.includes('UID_CONFLICT')) {
              if (attempt < 2) {
                await sleep(1000 * (attempt + 1));
                try { await rtcClientRef.current?.leave?.(); } catch {}
                if (joinedRef.current || seq !== joinSeqRef.current) return;
                makeClient();
                return attemptJoin(attempt + 1);
              }
              throw new Error('UID_CONFLICT: This username is already connected. Close other tabs/sessions and try again.');
            }
            // Retry once for transient websocket abort/network errors
            const lower = msg.toLowerCase();
            if ((lower.includes('ws') && lower.includes('abort')) || lower.includes('websocket') || lower.includes('network')) {
              if (attempt < 1) {
                await sleep(700);
                try { await rtcClientRef.current?.leave?.(); } catch {}
                if (joinedRef.current || seq !== joinSeqRef.current) return;
                makeClient();
                return attemptJoin(attempt + 1);
              }
            }
            // Retry for OPERATION_ABORTED by recreating client (cancel token canceled)
            if (lower.includes('operation_aborted') || lower.includes('cancel token')) {
              if (attempt < 2) {
                await sleep(400);
                try { await rtcClientRef.current?.leave?.(); } catch {}
                if (joinedRef.current || seq !== joinSeqRef.current) return;
                makeClient();
                return attemptJoin(attempt + 1);
              }
            }
            throw e;
          }
        };

        await attemptJoin(0);
        setJoined(true);
        joinedRef.current = true;
        setIsJoining(false);

        // Subscribe to remote audio and enable volume indicators for active speaker UI
        try {
          const client = rtcClientRef.current;
          if (client) {
            client.on('user-published', async (user: any, mediaType: any) => {
              try {
                await client.subscribe(user, mediaType);
                if (mediaType === 'audio') {
                  user.audioTrack?.play?.();
                }
              } catch {}
            });
            client.on('user-unpublished', (user: any) => {
              try { user.audioTrack?.stop?.(); } catch {}
            });
            try { client.enableAudioVolumeIndicator?.(); } catch {}
            client.on('volume-indicator', (volumes: Array<{ uid: string | number; level: number }>) => {
              try {
                volumes.forEach((v) => {
                  const raw = String(v.uid);
                  const uname = raw.includes(':') ? raw.split(':')[0] : raw;
                  const level = Number(v.level || 0);
                  window.dispatchEvent(new CustomEvent('volume_indicator', { detail: { username: uname, level } }));
                });
              } catch {}
            });
          }
        } catch {}

        // Publish local microphone if role allows
        try {
          const client = rtcClientRef.current;
          const role = roleRef.current;
          if (client && ['host','co-host','speaker'].includes(role)) {
            const { default: AgoraRTC } = await import('agora-rtc-sdk-ng');
            if (!micTrackRef.current) {
              micTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
              await client.publish([micTrackRef.current]);
            }
          }
        } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join room");
        setIsJoining(false);
        toast.error("Failed to join room. Please try again.");
      } finally {
        // allow future navigation/join attempts
        joiningRef.current = false;
      }
    };
    if (user && roomId) joinRoom();
    return () => {
      // On re-renders, do not force leave; just reset transient guards.
      joiningRef.current = false;
      rtmLoggedInRef.current = false;
      // keep joinedRef/state; unmount cleanup will handle leave
    };
  }, [roomId, user]);

  // Unmount cleanup: leave RTC, remove participant, optionally end room if host
  useEffect(() => {
    return () => {
      try { rtcClientRef.current?.leave?.(); } catch {}
      try { micTrackRef.current?.stop?.(); micTrackRef.current?.close?.(); } catch {}
      micTrackRef.current = null;
      try {
        if (roleRef.current === 'host' && user?._id) {
          const env = process.env.NEXT_PUBLIC_ENV;
          if (env !== 'DEV') {
            try {
              sdk.quickAuth?.getToken()?.then((t: any) => {
                const tk = t?.token || '';
                endProtectedRoom(roomId, user._id as string, tk);
              }).catch(() => {});
            } catch {}
          } else {
            endProtectedRoom(roomId, user._id as string, '');
          }
        }
      } catch {}
      joinedRef.current = false;
      rtmTokenRef.current = null;
      rtcUidRef.current = '';
      rtmUidRef.current = '';
    };
  }, []);

  // React to local mute/unmute requests from Footer
  useEffect(() => {
    const onLocalMute = async (e: any) => {
      try {
        const uname = String(e?.detail?.username || '');
        const muted = Boolean(e?.detail?.muted);
        if (!uname || String(user?.username || '') !== uname) return;
        if (micTrackRef.current) {
          await micTrackRef.current.setEnabled(!muted);
        }
      } catch {}
    };
    window.addEventListener('mute_state_local', onLocalMute as EventListener);
    return () => window.removeEventListener('mute_state_local', onLocalMute as EventListener);
  }, [user?.username]);

  // React to role changes to (un)publish mic
  useEffect(() => {
    const reconfigureForRole = async (newRole: string) => {
      const client = rtcClientRef.current;
      if (!client) return;
      const canSpeak = ['host','co-host','speaker'].includes(newRole);
      try {
        if (canSpeak) {
          if (!micTrackRef.current) {
            const { default: AgoraRTC } = await import('agora-rtc-sdk-ng');
            micTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
            await client.publish([micTrackRef.current]);
          }
        } else {
          if (micTrackRef.current) {
            try { await client.unpublish([micTrackRef.current]); } catch {}
            try { micTrackRef.current.stop(); micTrackRef.current.close(); } catch {}
            micTrackRef.current = null;
          }
        }
      } catch {}
    };

    const onRoleEvent = (ev: any) => {
      try {
        const type = ev?.detail?.type;
        const newRole = String(ev?.detail?.newRole || '').toLowerCase();
        if (type === 'role_change_complete' && newRole) {
          roleRef.current = newRole;
          reconfigureForRole(newRole);
        }
      } catch {}
    };
    window.addEventListener('role_change_event', onRoleEvent as EventListener);
    return () => window.removeEventListener('role_change_event', onRoleEvent as EventListener);
  }, []);

  // Perform RTM login and channel join when client becomes available and RTC has joined
  useEffect(() => {
    const loginRtm = async () => {
      try {
        if (!joined || !user || !rtmClient || rtmLoggedInRef.current) return;
        const uid = rtmUidRef.current || String(user.username);
        let token = rtmTokenRef.current;
        if (!token) {
          const res = await getAgoraRtmToken({ uid });
          if (!res.ok) return;
          token = res.data?.result?.token || res.data?.data?.token || res.data?.token;
          rtmTokenRef.current = token || null;
        }
        if (!token) return;
        await rtmClient.login({ uid, token });
        const ch = rtmClient.createChannel(roomId);
        await ch.join();
        setChannel(ch);
        rtmLoggedInRef.current = true;
        setRtmReady(true);
      } catch (e) {
        console.warn('[Agora - CallClient] RTM login/join failed', e);
      }
    };
    loginRtm();
  }, [joined, rtmClient, roomId, user, setChannel]);

  useEffect(() => {
    const addParticipant = async () => {
      if (!joined || !user) return;
      let token: string | null = null;
      if (process.env.NEXT_PUBLIC_ENV !== 'DEV') {
        try { token = (await sdk.quickAuth.getToken()).token; } catch { token = null; }
      }
      try {
        await addParticipantToRoom(
          roomId,
          { userId: user.username, userFid: user.fid, role: roleRef.current },
          token
        );
        setParticipantAdded(true);
        try { window.dispatchEvent(new CustomEvent('participants_refresh', { detail: { roomId } })); } catch {}
      } catch {}
    };
    addParticipant();
  }, [joined, user, roomId]);

  // Notify channel immediately after backend persistence to trigger presence refresh on all clients
  useEffect(() => {
    const announceJoin = async () => {
      if (!joined || !participantAdded || !rtmReady || !channel || !user) return;
      try {
        await channel.sendMessage({ text: JSON.stringify({ type: 'USER_JOINED', payload: { username: String(user.username), fid: String(user.fid || ''), role: roleRef.current }, ts: Date.now() }) });
        // Immediately sync role for all clients to avoid UI lag on refresh
        await channel.sendMessage({ text: JSON.stringify({ type: 'ROLE_SYNC', payload: { username: String(user.username), fid: String(user.fid || ''), role: roleRef.current }, ts: Date.now() }) });
      } catch {}
    };
    announceJoin();
  }, [joined, participantAdded, rtmReady, channel, user]);

  useEffect(() => {
    const removeParticipant = async () => {
      let token: string | null = null;
      if (process.env.NEXT_PUBLIC_ENV !== 'DEV') {
        try { token = (await sdk.quickAuth.getToken()).token; } catch { token = null; }
      }
      if (user?.fid) {
        try {
          await removeParticipantFromRoom(roomId, { userId: user.username, userFid: user.fid }, token);
        } catch {}
      }
    };
    const handleBeforeUnload = () => { if (joinedRef.current) { try { rtcClientRef.current?.leave?.(); } catch {} } removeParticipant(); };
    const handlePageHide = () => { if (joinedRef.current) { try { rtcClientRef.current?.leave?.(); } catch {} } removeParticipant(); };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      if (joinedRef.current) { try { rtcClientRef.current?.leave?.(); } catch {} }
      removeParticipant();
    };
  }, [user, roomId]);

  const navigate = useNavigateWithLoader();

  if (error && error !== "Failed to fetch room codes") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error Joining Room</h1>
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => navigate("/")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">Go Back</button>
        </div>
      </div>
    );
  }

  if (error === "Failed to fetch room codes") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Room has already ended</h1>
          <button onClick={() => navigate("/")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">Go Back</button>
        </div>
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <RoleChangeHandler />
      <Header roomId={roomId} />
      <Conference roomId={roomId} />
      {joined && <Footer roomId={roomId} />}
    </div>
  );
}
