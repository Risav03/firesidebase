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
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventTsRef = useRef<number>(Date.now());
  const localUidRef = useRef<number | null>(null);

  const BACKEND_URL =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      : "";

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
          if (clientRef.current) {
            await clientRef.current.subscribe(user, mediaType as any);
          }
          if (mediaType === "audio" && user.audioTrack) {
            user.audioTrack.play();
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

      // Derive the room ID from the URL path (last segment)
      if (typeof window !== "undefined") {
        const pathParts = window.location.pathname.split("/");
        setRoomId(pathParts[pathParts.length - 1] || null);
      }

      // Create and publish local audio track if not listener
      if (agoraRole === "host") {
        try {
          const AgoraRTC = await getAgoraRTC();
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
          localAudioTrackRef.current = audioTrack;
          setLocalAudioTrack(audioTrack);
          await audioTrack.setEnabled(false); // Start muted
          await client.publish([audioTrack]);
          setIsLocalAudioEnabledState(false);
        } catch (err) {
          console.warn("[Agora] No microphone found, joining without audio track:", err);
        }
      }

      // Set local peer info
      setLocalPeer({
        uid,
        name: "", // Will be set via metadata
        roleName: role,
        id: String(uid),
        metadata,
        isLocal: true,
      });
    },
    [getClient]
  );

  // ── Leave ─────────────────────────────────────────────────────────────────────

  const leave = useCallback(async () => {
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
    setRoomId(null);
    localUidRef.current = null;
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
          await audioTrack.setEnabled(false); // Start muted
          await client.publish([audioTrack]);
          setIsLocalAudioEnabledState(false);
        } catch (err) {
          console.warn("[Agora] No microphone found during role change:", err);
        }
      } else if (agoraRole === "audience" && localAudioTrackRef.current) {
        await client.unpublish([localAudioTrackRef.current]);
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

  const toggleAudio = useCallback(async () => {
    if (localAudioTrackRef.current) {
      const newState = !localAudioTrackRef.current.enabled;
      await localAudioTrackRef.current.setEnabled(newState);
      setIsLocalAudioEnabledState(newState);
    }
  }, []);

  const setLocalAudioEnabled = useCallback(async (enabled: boolean) => {
    if (localAudioTrackRef.current) {
      await localAudioTrackRef.current.setEnabled(enabled);
      setIsLocalAudioEnabledState(enabled);
    }
  }, []);

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
          await audioTrack.setEnabled(false);
          await client.publish([audioTrack]);
          setIsLocalAudioEnabledState(false);
        } catch (err) {
          console.warn("[Agora] No microphone found during setClientRole:", err);
        }
      } else if (role === "audience" && localAudioTrackRef.current) {
        await client.unpublish([localAudioTrackRef.current]);
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
    }
  }, [getClient]);

  const unpublishAudio = useCallback(async () => {
    const client = await getClient();
    if (localAudioTrackRef.current) {
      await client.unpublish([localAudioTrackRef.current]);
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
      if (roomId && BACKEND_URL) {
        fetch(
          `${BACKEND_URL}/api/rooms/public/${roomId}/events`,
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
    [roomId, BACKEND_URL]
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
    if (!isConnected || !roomId || !BACKEND_URL) {
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
          `${BACKEND_URL}/api/rooms/public/${roomId}/events?since=${lastEventTsRef.current}`
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
  }, [isConnected, roomId, BACKEND_URL]);

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
