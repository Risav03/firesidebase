"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import type {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";

// Lazy-load the Agora SDK at runtime (browser only) to avoid
// "window is not defined" during SSR.
let _AgoraRTC: typeof import("agora-rtc-sdk-ng").default | null = null;
async function getAgoraRTC() {
  if (!_AgoraRTC) {
    const mod = await import("agora-rtc-sdk-ng");
    _AgoraRTC = mod.default;
  }
  return _AgoraRTC;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AgoraPeer {
  uid: number;
  name: string;
  roleName: string;
  id: string; // string version of uid for compatibility
  metadata?: string; // JSON string with avatar, fid, role, wallet
  audioTrack?: any;
  isLocal?: boolean;
}

interface AgoraContextValue {
  // State
  client: IAgoraRTCClient | null;
  localAudioTrack: IMicrophoneAudioTrack | null;
  isConnected: boolean;
  localPeer: AgoraPeer | null;
  remotePeers: Map<number, AgoraPeer>;
  remoteUsers: IAgoraRTCRemoteUser[];
  audioLevels: Map<number, number>;
  dominantSpeaker: number | null;
  isLocalAudioEnabled: boolean;

  // Actions
  join: (
    appId: string,
    channel: string,
    token: string,
    uid: number,
    role: string,
    roomId: string,
    metadata?: string
  ) => Promise<void>;
  leave: () => Promise<void>;
  toggleAudio: () => Promise<void>;
  setLocalAudioEnabled: (enabled: boolean) => Promise<void>;
  setClientRole: (role: "host" | "audience") => Promise<void>;
  renewToken: (token: string) => Promise<void>;
  changeRole: (newRole: string, newToken: string, metadata?: string) => Promise<void>;
  publishAudio: () => Promise<void>;
  unpublishAudio: () => Promise<void>;
  updateLocalMetadata: (metadata: string) => void;
  setPeerMetadata: (uid: number, metadata: string) => void;
  setPeerInfo: (
    uid: number,
    info: { name?: string; roleName?: string; metadata?: string }
  ) => void;

  // Custom events (replaces useCustomEvent from HMS)
  sendCustomEvent: (type: string, data: any) => void;
  onCustomEvent: (
    type: string,
    handler: (data: any) => void
  ) => () => void;
}

const AgoraContext = createContext<AgoraContextValue | null>(null);

export function useAgoraContext(): AgoraContextValue {
  const context = useContext(AgoraContext);
  if (!context) {
    throw new Error("useAgoraContext must be used within an AgoraProvider");
  }
  return context;
}

// ── Provider ───────────────────────────────────────────────────────────────────

interface AgoraProviderProps {
  children: ReactNode;
}

export function AgoraProvider({ children }: AgoraProviderProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const eventHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(
    new Map()
  );

  const [isConnected, setIsConnected] = useState(false);
  const [localPeer, setLocalPeer] = useState<AgoraPeer | null>(null);
  const [remotePeers, setRemotePeers] = useState<Map<number, AgoraPeer>>(
    new Map()
  );
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [audioLevels, setAudioLevels] = useState<Map<number, number>>(
    new Map()
  );
  const [dominantSpeaker, setDominantSpeaker] = useState<number | null>(null);
  const [isLocalAudioEnabled, setIsLocalAudioEnabledState] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] =
    useState<IMicrophoneAudioTrack | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  // Stable ref for roomId so leave() (which is memoized with []) can read
  // the current value without adding roomId to its dependency array.
  const roomIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const participantPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const localUidRef = useRef<number | null>(null);
  const isAudioPublishedRef = useRef(false);
  // Track UIDs that Agora told us have left, so the poll doesn't re-add them
  // before the backend marks them inactive. Entries auto-expire after 15 s.
  const recentlyLeftRef = useRef<Map<number, number>>(new Map());

  // Initialize the client lazily
  const getClient = useCallback(async () => {
    if (!clientRef.current) {
      const AgoraRTC = await getAgoraRTC();
      clientRef.current = AgoraRTC.createClient({
        mode: "live",
        codec: "vp8",
      });

      // Enable volume indicator
      clientRef.current.enableAudioVolumeIndicator();

      // Event: remote user published
      clientRef.current.on(
        "user-published",
        async (user: IAgoraRTCRemoteUser, mediaType: string) => {
          try {
            if (clientRef.current) {
              await clientRef.current.subscribe(user, mediaType as any);
            }
          } catch (err) {
            console.error("[Agora] Failed to subscribe to remote user:", err);
            return; // Don't try to play if subscribe failed
          }
          if (mediaType === "audio" && user.audioTrack) {
            try {
              user.audioTrack.play();
            } catch (err) {
              console.error("[Agora] Failed to play remote audio track:", err);
            }
          }
          setRemoteUsers((prev) => {
            const exists = prev.find((u) => u.uid === user.uid);
            if (exists) return prev.map((u) => (u.uid === user.uid ? user : u));
            return [...prev, user];
          });
          // Update peer audio track
          setRemotePeers((prev) => {
            const next = new Map(prev);
            const existing = next.get(user.uid as number);
            if (existing) {
              next.set(user.uid as number, {
                ...existing,
                audioTrack: user.audioTrack,
              });
            } else {
              next.set(user.uid as number, {
                uid: user.uid as number,
                name: `User ${user.uid}`,
                roleName: "listener",
                id: String(user.uid),
                audioTrack: user.audioTrack,
              });
            }
            return next;
          });
        }
      );

      // Event: remote user unpublished
      clientRef.current.on(
        "user-unpublished",
        (user: IAgoraRTCRemoteUser, mediaType: string) => {
          if (mediaType === "audio") {
            setRemoteUsers((prev) =>
              prev.map((u) => (u.uid === user.uid ? user : u))
            );
            // Clear audioTrack so components show the muted indicator
            setRemotePeers((prev) => {
              const next = new Map(prev);
              const existing = next.get(user.uid as number);
              if (existing) {
                next.set(user.uid as number, {
                  ...existing,
                  audioTrack: undefined,
                });
              }
              return next;
            });
          }
        }
      );

      // Event: user joined
      clientRef.current.on("user-joined", (user: IAgoraRTCRemoteUser) => {
        setRemotePeers((prev) => {
          const next = new Map(prev);
          if (!next.has(user.uid as number)) {
            next.set(user.uid as number, {
              uid: user.uid as number,
              name: `User ${user.uid}`,
              roleName: "listener",
              id: String(user.uid),
            });
          }
          return next;
        });
      });

      // Event: user left
      clientRef.current.on(
        "user-left",
        (user: IAgoraRTCRemoteUser) => {
          // Track this UID so the poll doesn't re-add it before the backend catches up
          recentlyLeftRef.current.set(user.uid as number, Date.now());
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
          setRemotePeers((prev) => {
            const next = new Map(prev);
            next.delete(user.uid as number);
            return next;
          });
        }
      );

      // Event: volume indicator
      clientRef.current.on("volume-indicator", (volumes) => {
        const newLevels = new Map<number, number>();
        let maxVolume = 0;
        let maxUid: number | null = null;

        for (const { uid, level } of volumes) {
          newLevels.set(uid as number, level);
          if (level > maxVolume) {
            maxVolume = level;
            maxUid = uid as number;
          }
        }

        setAudioLevels(newLevels);
        setDominantSpeaker(maxVolume > 5 ? maxUid : null);
      });

      // Event: connection state change
      clientRef.current.on("connection-state-change", (curState) => {
        setIsConnected(curState === "CONNECTED");
      });

      // Event: token expiring — request a new token before it expires
      clientRef.current.on("token-privilege-will-expire", async () => {
        console.log("[Agora] Token privilege will expire, requesting renewal...");
        const handlers = eventHandlersRef.current.get("TOKEN_EXPIRING");
        if (handlers) {
          for (const handler of Array.from(handlers)) {
            handler({});
          }
        }
      });
    }
    return clientRef.current;
  }, []);

  // ── Join ──────────────────────────────────────────────────────────────────────

  const join = useCallback(
    async (
      appId: string,
      channel: string,
      token: string,
      uid: number,
      role: string,
      roomId: string,
      metadata?: string
    ) => {
      const client = await getClient();

      // Prevent joining if already connected or connecting
      if (client.connectionState === "CONNECTED" || client.connectionState === "CONNECTING") {
        console.warn("[Agora] Already connected/connecting, skipping join");
        return;
      }

      // Set client role based on app role
      const agoraRole =
        role === "listener" ? "audience" : "host";
      await client.setClientRole(agoraRole);

      await client.join(appId, channel, token, uid);
      setIsConnected(true);
      localUidRef.current = uid;

      // Use the explicitly passed room ID instead of parsing from URL
      setRoomId(roomId);
      roomIdRef.current = roomId;

      // Create local audio track if not listener.
      // Publish immediately and mute with setMuted(true) so the mic capture stays
      // alive. This prevents stale-track issues where the browser releases the mic
      // between creation and the first unmute, causing audio to not actually flow.
      if (agoraRole === "host") {
        try {
          const AgoraRTC = await getAgoraRTC();
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localAudioTrackRef.current = audioTrack;
          setLocalAudioTrack(audioTrack);

          // Publish immediately, then mute – keeps the WebRTC connection alive
          await client.publish([audioTrack]);
          await audioTrack.setMuted(true);
          isAudioPublishedRef.current = true;
          setIsLocalAudioEnabledState(false);
          console.log("[Agora] Mic track created, published, and muted (ready for unmute)");
        } catch (err) {
          console.warn("[Agora] No microphone found, joining without audio track:", err);
        }
      }

      // Set local peer info — extract name from metadata if available
      let peerName = "";
      if (metadata) {
        try {
          const meta = JSON.parse(metadata);
          peerName = meta.displayName || meta.username || "";
        } catch {}
      }
      setLocalPeer({
        uid,
        name: peerName,
        roleName: role,
        id: String(uid),
        metadata,
        isLocal: true,
      });

      // Announce presence to other peers (especially important for listeners
      // who are invisible in Agora "live" mode).
      // Use roomId parameter directly since state may not be set yet.
      fetch(`/api/rooms/${roomId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PEER_JOINED",
          data: { uid, name: peerName, roleName: role, metadata },
          senderId: uid,
        }),
      }).catch((err: unknown) =>
        console.warn("[Agora] Failed to send PEER_JOINED event:", err)
      );
    },
    [getClient]
  );

  // ── Leave ─────────────────────────────────────────────────────────────────────

  const leave = useCallback(async () => {
    // Notify other peers before disconnecting (use ref for current roomId)
    const currentRoomId = roomIdRef.current;
    if (currentRoomId && localUidRef.current != null) {
      fetch(`/api/rooms/${currentRoomId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PEER_LEFT",
          data: { uid: localUidRef.current },
          senderId: localUidRef.current,
        }),
      }).catch(() => {});
    }

    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
      setLocalAudioTrack(null);
    }

    if (clientRef.current) {
      await clientRef.current.leave();
    }

    setIsConnected(false);
    setLocalPeer(null);
    setRemotePeers(new Map());
    setRemoteUsers([]);
    setAudioLevels(new Map());
    setDominantSpeaker(null);
    setIsLocalAudioEnabledState(false);
    recentlyLeftRef.current.clear();
    setRoomId(null);
    roomIdRef.current = null;
    localUidRef.current = null;
    isAudioPublishedRef.current = false;
  }, []);

  // ── Token Renewal ─────────────────────────────────────────────────────────────

  const renewToken = useCallback(async (token: string) => {
    if (clientRef.current) {
      await clientRef.current.renewToken(token);
    }
  }, []);

  // ── Change Role (Agora-native, no disconnect) ────────────────────────────────

  const changeRole = useCallback(
    async (newRole: string, newToken: string, metadata?: string) => {
      const client = await getClient();
      const agoraRole = newRole === "listener" ? "audience" : "host";

      // Renew token first (new role may need different privileges)
      await client.renewToken(newToken);

      // Switch Agora client role
      await client.setClientRole(agoraRole);

      // Handle audio track lifecycle
      if (agoraRole === "host" && !localAudioTrackRef.current) {
        try {
          const AgoraRTC = await getAgoraRTC();
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localAudioTrackRef.current = audioTrack;
          setLocalAudioTrack(audioTrack);

          // Publish immediately, then mute
          await client.publish([audioTrack]);
          await audioTrack.setMuted(true);
          isAudioPublishedRef.current = true;
          setIsLocalAudioEnabledState(false);
          console.log("[Agora] Mic track created during role change, published and muted");
        } catch (err) {
          console.warn("[Agora] No microphone found during role change:", err);
        }
      } else if (agoraRole === "audience" && localAudioTrackRef.current) {
        if (isAudioPublishedRef.current) {
          await client.unpublish([localAudioTrackRef.current]);
          isAudioPublishedRef.current = false;
        }
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
        setLocalAudioTrack(null);
        setIsLocalAudioEnabledState(false);
      }

      // Update local peer info
      setLocalPeer((prev) =>
        prev
          ? {
              ...prev,
              roleName: newRole,
              metadata: metadata || prev.metadata,
            }
          : null
      );
    },
    [getClient]
  );

  // ── Audio Controls ────────────────────────────────────────────────────────────

  /**
   * Lazily create a microphone audio track (without publishing).
   * This covers cases where the initial track creation during join failed
   * (e.g. mic permission denied, no device, WebView restrictions).
   */
  const ensureAudioTrack = useCallback(async () => {
    if (localAudioTrackRef.current) return localAudioTrackRef.current;

    const client = await getClient();

    if (client.connectionState !== "CONNECTED") {
      console.warn("[Agora] Cannot create audio track: not connected");
      return null;
    }

    try {
      const AgoraRTC = await getAgoraRTC();
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localAudioTrackRef.current = audioTrack;
      setLocalAudioTrack(audioTrack);
      isAudioPublishedRef.current = false;
      console.log("[Agora] Audio track created on demand (not yet published)");
      return audioTrack;
    } catch (err) {
      console.error("[Agora] Failed to create microphone track:", err);
      return null;
    }
  }, [getClient]);

  const toggleAudio = useCallback(async () => {
    const client = await getClient();
    let track = localAudioTrackRef.current;

    if (!track) {
      console.log("[Agora] No audio track found, attempting to create one...");
      track = await ensureAudioTrack();
    }

    if (!track) {
      console.warn("[Agora] toggleAudio: could not obtain an audio track");
      return;
    }

    // Ensure the track is published to the channel first.
    // Normally this is done during join/changeRole, but handle the edge case
    // where track creation was deferred (e.g. mic permission delayed).
    if (!isAudioPublishedRef.current) {
      try {
        await client.publish([track]);
        isAudioPublishedRef.current = true;
        // User explicitly pressed unmute → go live
        await track.setMuted(false);
        setIsLocalAudioEnabledState(true);
        console.log("[Agora] Audio published and unmuted");
      } catch (err) {
        console.error("[Agora] Failed to publish audio:", err);
      }
      return;
    }

    // Toggle mute state via setMuted – this is the Agora-recommended approach.
    // Unlike publish/unpublish, setMuted keeps the mic capture pipeline alive
    // so audio flows reliably when unmuting.
    if (track.muted) {
      try {
        await track.setMuted(false);
        setIsLocalAudioEnabledState(true);
        console.log("[Agora] Audio unmuted (setMuted)");
      } catch (err) {
        console.error("[Agora] Failed to unmute audio:", err);
      }
    } else {
      try {
        await track.setMuted(true);
        setIsLocalAudioEnabledState(false);
        console.log("[Agora] Audio muted (setMuted)");
      } catch (err) {
        console.error("[Agora] Failed to mute audio:", err);
      }
    }
  }, [getClient, ensureAudioTrack]);

  const setLocalAudioEnabled = useCallback(async (enabled: boolean) => {
    const client = await getClient();
    let track = localAudioTrackRef.current;

    if (!track && enabled) {
      console.log("[Agora] No audio track found, attempting to create one...");
      track = await ensureAudioTrack();
    }

    if (!track) return;

    // Ensure the track is published first
    if (!isAudioPublishedRef.current) {
      try {
        await client.publish([track]);
        isAudioPublishedRef.current = true;
      } catch (err) {
        console.error("[Agora] Failed to publish audio:", err);
        return;
      }
    }

    // Use setMuted to control audio flow (keeps mic capture alive)
    if (enabled) {
      try {
        await track.setMuted(false);
        setIsLocalAudioEnabledState(true);
        console.log("[Agora] Audio enabled (setMuted false)");
      } catch (err) {
        console.error("[Agora] Failed to enable audio:", err);
      }
    } else {
      try {
        await track.setMuted(true);
        setIsLocalAudioEnabledState(false);
        console.log("[Agora] Audio disabled (setMuted true)");
      } catch (err) {
        console.error("[Agora] Failed to disable audio:", err);
      }
    }
  }, [getClient, ensureAudioTrack]);

  // ── Role Management ───────────────────────────────────────────────────────────

  const setClientRole = useCallback(
    async (role: "host" | "audience") => {
      const client = await getClient();
      await client.setClientRole(role);

      if (role === "host" && !localAudioTrackRef.current) {
        try {
          const AgoraRTC = await getAgoraRTC();
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localAudioTrackRef.current = audioTrack;
          setLocalAudioTrack(audioTrack);

          // Publish immediately, then mute
          await client.publish([audioTrack]);
          await audioTrack.setMuted(true);
          isAudioPublishedRef.current = true;
          setIsLocalAudioEnabledState(false);
        } catch (err) {
          console.warn("[Agora] No microphone found during setClientRole:", err);
        }
      } else if (role === "audience" && localAudioTrackRef.current) {
        if (isAudioPublishedRef.current) {
          await client.unpublish([localAudioTrackRef.current]);
          isAudioPublishedRef.current = false;
        }
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
        setLocalAudioTrack(null);
        setIsLocalAudioEnabledState(false);
      }
    },
    [getClient]
  );

  const publishAudio = useCallback(async () => {
    const client = await getClient();
    if (!localAudioTrackRef.current) {
      const AgoraRTC = await getAgoraRTC();
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localAudioTrackRef.current = audioTrack;
      setLocalAudioTrack(audioTrack);
    }
    if (localAudioTrackRef.current) {
      await client.publish([localAudioTrackRef.current]);
      isAudioPublishedRef.current = true;
    }
  }, [getClient]);

  const unpublishAudio = useCallback(async () => {
    const client = await getClient();
    if (localAudioTrackRef.current) {
      if (isAudioPublishedRef.current) {
        await client.unpublish([localAudioTrackRef.current]);
        isAudioPublishedRef.current = false;
      }
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
      setLocalAudioTrack(null);
      setIsLocalAudioEnabledState(false);
    }
  }, [getClient]);

  // ── Metadata ──────────────────────────────────────────────────────────────────

  const updateLocalMetadata = useCallback((metadata: string) => {
    setLocalPeer((prev) => (prev ? { ...prev, metadata } : null));
  }, []);

  const setPeerMetadata = useCallback((uid: number, metadata: string) => {
    setRemotePeers((prev) => {
      const next = new Map(prev);
      const existing = next.get(uid);
      if (existing) {
        next.set(uid, { ...existing, metadata });
      }
      return next;
    });
  }, []);

  const setPeerInfo = useCallback(
    (
      uid: number,
      info: { name?: string; roleName?: string; metadata?: string }
    ) => {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(uid);
        if (existing) {
          next.set(uid, { ...existing, ...info });
        } else {
          next.set(uid, {
            uid,
            name: info.name || `User ${uid}`,
            roleName: info.roleName || "listener",
            id: String(uid),
            metadata: info.metadata,
          });
        }
        return next;
      });
    },
    []
  );

  // ── Custom Events (replaces HMS useCustomEvent) ───────────────────────────────

  const sendCustomEvent = useCallback(
    (type: string, data: any) => {
      // Broadcast to local handlers
      const handlers = eventHandlersRef.current.get(type);
      if (handlers) {
        for (const handler of Array.from(handlers)) {
          handler(data);
        }
      }

      // Relay via backend so remote peers receive the event
      if (roomId) {
        fetch(
          `/api/rooms/${roomId}/events`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type,
              data,
              senderId: localUidRef.current,
            }),
          }
        ).catch((err: unknown) =>
          console.warn("Failed to relay custom event:", err)
        );
      }
    },
    [roomId]
  );

  const onCustomEvent = useCallback(
    (type: string, handler: (data: any) => void) => {
      if (!eventHandlersRef.current.has(type)) {
        eventHandlersRef.current.set(type, new Set());
      }
      eventHandlersRef.current.get(type)!.add(handler);

      // Return cleanup function
      return () => {
        const handlers = eventHandlersRef.current.get(type);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            eventHandlersRef.current.delete(type);
          }
        }
      };
    },
    []
  );

  // Poll backend for incoming custom events from remote peers
  useEffect(() => {
    if (!isConnected || !roomId) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    // Reset the cursor so we only see events from now
    lastEventTsRef.current = Date.now();

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/events?since=${lastEventTsRef.current}`
        );
        if (!res.ok) return;
        const json = await res.json();
        const events: Array<{ type: string; data: any; senderId?: number; ts: number }> =
          json?.data?.events ?? [];

        for (const evt of events) {
          // Skip events we sent ourselves
          if (evt.senderId != null && evt.senderId === localUidRef.current) continue;

          if (evt.ts > lastEventTsRef.current) {
            lastEventTsRef.current = evt.ts;
          }

          const handlers = eventHandlersRef.current.get(evt.type);
          if (handlers) {
            for (const handler of Array.from(handlers)) {
              handler(evt.data);
            }
          }
        }
      } catch {
        // Network hiccup — will retry on next tick
      }
    };

    pollTimerRef.current = setInterval(poll, 1500);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isConnected, roomId]);

  // ── Event-driven participant tracking ─────────────────────────────────────
  // Replaces the old 3-second participant poll.  Audience members (listeners)
  // are invisible in Agora "live" mode, so we use custom PEER_JOINED /
  // PEER_LEFT events delivered via the existing event-relay channel to
  // discover them.  A single initial fetch bootstraps the list on join, and
  // a low-frequency 30-second reconciliation sweep catches any missed events.

  // Handle incoming PEER_JOINED events from remote peers
  useEffect(() => {
    if (!isConnected) return;

    const cleanup = onCustomEvent("PEER_JOINED", (data: {
      uid: number;
      name: string;
      roleName: string;
      metadata?: string;
    }) => {
      const uid = data.uid;
      if (uid === localUidRef.current) return; // skip self
      if (recentlyLeftRef.current.has(uid)) return; // just left

      setRemotePeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(uid);
        next.set(uid, {
          uid,
          name: data.name || existing?.name || `User ${uid}`,
          roleName: data.roleName || existing?.roleName || "listener",
          id: String(uid),
          metadata: data.metadata || existing?.metadata,
          audioTrack: existing?.audioTrack, // preserve if already publishing
        });
        return next;
      });
    });

    return cleanup;
  }, [isConnected, onCustomEvent]);

  // Handle incoming PEER_LEFT events from remote peers
  useEffect(() => {
    if (!isConnected) return;

    const cleanup = onCustomEvent("PEER_LEFT", (data: { uid: number }) => {
      const uid = data.uid;
      if (uid === localUidRef.current) return;
      recentlyLeftRef.current.set(uid, Date.now());
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== uid));
      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.delete(uid);
        return next;
      });
    });

    return cleanup;
  }, [isConnected, onCustomEvent]);

  // Send best-effort PEER_LEFT on tab close / navigation away
  useEffect(() => {
    if (!isConnected || !roomId) return;

    const handleBeforeUnload = () => {
      if (localUidRef.current == null) return;
      // Use sendBeacon for reliability during page unload
      const payload = JSON.stringify({
        type: "PEER_LEFT",
        data: { uid: localUidRef.current },
        senderId: localUidRef.current,
      });
      navigator.sendBeacon?.(
        `/api/rooms/${roomId}/events`,
        new Blob([payload], { type: "application/json" })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isConnected, roomId]);

  // Initial fetch on connect + low-frequency reconciliation (every 30s)
  useEffect(() => {
    if (!isConnected || !roomId) {
      if (participantPollTimerRef.current) {
        clearInterval(participantPollTimerRef.current);
        participantPollTimerRef.current = null;
      }
      return;
    }

    const reconcileParticipants = async () => {
      try {
        // Purge recently-left entries older than 15 seconds
        const now = Date.now();
        recentlyLeftRef.current.forEach((ts, uid) => {
          if (now - ts > 15_000) recentlyLeftRef.current.delete(uid);
        });

        const res = await fetch(
          `/api/rooms/${roomId}/participants`
        );
        if (!res.ok) return;
        const json = await res.json();
        const participants: Array<{
          userId: string;
          username: string;
          displayName: string;
          pfp_url: string;
          role: string;
        }> = json?.data?.participants ?? [];

        // Build a set of active participant UIDs from the backend
        const activeUids = new Set<number>();
        for (const p of participants) {
          const uid = parseInt(p.userId);
          if (!isNaN(uid) && uid !== localUidRef.current) {
            activeUids.add(uid);
          }
        }

        setRemotePeers((prev) => {
          const next = new Map(prev);
          let changed = false;

          // Update / add peers from the backend response
          for (const p of participants) {
            const uid = parseInt(p.userId);
            // Skip local user
            if (uid === localUidRef.current) continue;
            // Skip peers that Agora told us just left (backend may lag)
            if (recentlyLeftRef.current.has(uid)) continue;

            const existing = next.get(uid);
            const name = p.displayName || p.username || `User ${uid}`;
            const roleName = p.role || "listener";
            const metadata = JSON.stringify({
              avatar: p.pfp_url || "",
              fid: p.userId,
              role: roleName,
              wallet: "",
            });

            if (existing) {
              // Only update if data actually changed (preserve audioTrack)
              if (
                existing.name !== name ||
                existing.roleName !== roleName ||
                existing.metadata !== metadata
              ) {
                next.set(uid, {
                  ...existing,
                  name,
                  roleName,
                  metadata,
                });
                changed = true;
              }
            } else {
              // New peer discovered (likely audience member not visible via Agora events)
              next.set(uid, {
                uid,
                name,
                roleName,
                id: String(uid),
                metadata,
              });
              changed = true;
            }
          }

          // Remove peers that are no longer active in the backend,
          // unless they have an active audioTrack (Agora publisher that
          // the backend hasn't caught up with yet).
          next.forEach((peer, uid) => {
            if (!activeUids.has(uid) && !peer.audioTrack) {
              next.delete(uid);
              changed = true;
            }
          });

          return changed ? next : prev;
        });

        // Also update localPeer name and role from backend data
        setLocalPeer((prev) => {
          if (!prev) return prev;
          const localData = participants.find(
            (p) => parseInt(p.userId) === localUidRef.current
          );
          if (localData) {
            const newName = localData.displayName || localData.username || prev.name;
            const newRole = localData.role || prev.roleName;
            if (prev.name !== newName || prev.roleName !== newRole) {
              return {
                ...prev,
                name: newName,
                roleName: newRole,
              };
            }
          }
          return prev;
        });
      } catch {
        // Network hiccup — will retry on next reconciliation cycle
      }
    };

    // Fetch once immediately on connect, then reconcile every 30 seconds
    reconcileParticipants();
    participantPollTimerRef.current = setInterval(reconcileParticipants, 30_000);

    return () => {
      if (participantPollTimerRef.current) {
        clearInterval(participantPollTimerRef.current);
        participantPollTimerRef.current = null;
      }
    };
  }, [isConnected, roomId]);

  // Keep localPeer.audioTrack in sync with the actual audio enabled state.
  // PanelMember (and other components) derive the muted indicator from
  // peer.audioTrack, so this must be updated whenever audio is toggled.
  useEffect(() => {
    setLocalPeer((prev) => {
      if (!prev) return prev;
      const newAudioTrack = isLocalAudioEnabled ? localAudioTrack : undefined;
      if (prev.audioTrack === newAudioTrack) return prev;
      return { ...prev, audioTrack: newAudioTrack };
    });
  }, [isLocalAudioEnabled, localAudioTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
      }
      if (clientRef.current) {
        clientRef.current.leave().catch(() => {});
      }
    };
  }, []);

  const value: AgoraContextValue = {
    client: clientRef.current,
    localAudioTrack,
    isConnected,
    localPeer,
    remotePeers,
    remoteUsers,
    audioLevels,
    dominantSpeaker,
    isLocalAudioEnabled,
    join,
    leave,
    renewToken,
    changeRole,
    toggleAudio,
    setLocalAudioEnabled,
    setClientRole,
    publishAudio,
    unpublishAudio,
    updateLocalMetadata,
    setPeerMetadata,
    setPeerInfo,
    sendCustomEvent,
    onCustomEvent,
  };

  return (
    <AgoraContext.Provider value={value}>{children}</AgoraContext.Provider>
  );
}
