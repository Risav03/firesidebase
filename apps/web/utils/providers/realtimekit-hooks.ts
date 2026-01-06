/**
 * RealtimeKit Hooks - Helper functions for migrating from 100ms
 * 
 * This file provides:
 * 1. Re-exports from RealtimeKit React SDK
 * 2. Helper functions for common operations
 * 3. Type definitions for RealtimeKit objects
 * 4. Custom hooks for common patterns
 * 
 * Usage notes based on Cloudflare docs:
 * - participant.id = session-specific peer ID (use for participant map lookups)
 * - participant.userId = persistent participant ID (use for Stage APIs)
 * - meeting.participants.joined is a collection, use .toArray() to iterate
 * - meeting.self.on('roomJoined'/'roomLeft') for room state, NOT meeting.meta
 * - audioUpdate is on individual participant, not on participant map
 */

import { useRealtimeKitMeeting, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================
// Type Definitions
// ============================================

export interface RealtimeKitParticipant {
  id: string;           // Session-specific peer ID
  userId: string;       // Persistent participant ID (use for Stage APIs)
  name: string;
  picture?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  stageStatus?: 'ON_STAGE' | 'OFF_STAGE' | 'REQUESTED_TO_JOIN_STAGE' | 'ACCEPTED_TO_JOIN_STAGE';
  presetName?: string;
  customParticipantId?: string;
  audioTrack?: any;
  videoTrack?: any;
  metadata?: string;
}

export interface RealtimeKitSelf extends RealtimeKitParticipant {
  permissions: RealtimeKitPermissions;
}

export interface RealtimeKitPermissions {
  // Audio permissions
  canDisableParticipantAudio: boolean;  // Can mute others
  canAllowParticipantAudio: boolean;    // Can unmute others
  
  // Participant management
  kickParticipant: boolean;             // Can kick participants
  
  // Stage permissions
  canAcceptStageRequests: boolean;
  canRequestToJoinStage: boolean;
  
  // Chat
  chatPublic: boolean;
  chatPrivate: boolean;
  
  // Media
  produceAudio: boolean;
  produceVideo: boolean;
}

export interface StageRequest {
  id: string;
  peerId: string;       // Session ID for participant lookup
  userId: string;       // Use this for grant/deny Stage APIs
  displayName: string;
  picture?: string;
  timestamp: string;
}

// ============================================
// Stage Status Constants
// ============================================

export const STAGE_STATUS = {
  ON_STAGE: 'ON_STAGE',
  OFF_STAGE: 'OFF_STAGE',
  REQUESTED_TO_JOIN_STAGE: 'REQUESTED_TO_JOIN_STAGE',
  ACCEPTED_TO_JOIN_STAGE: 'ACCEPTED_TO_JOIN_STAGE',
} as const;

// ============================================
// Preset/Role Mapping
// ============================================

export const PRESET_TO_ROLE: Record<string, string> = {
  'host': 'host',
  'co-host': 'co-host',
  'speaker': 'speaker',
  'listener': 'listener',
};

export const ROLE_PRIORITY: Record<string, number> = {
  'host': 1,
  'co-host': 2,
  'speaker': 3,
  'listener': 4,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get all participants as an array
 * Note: meeting.participants.joined is a collection, not an array
 */
export function getParticipantsArray(meeting: any): RealtimeKitParticipant[] {
  if (!meeting?.participants?.joined) return [];
  try {
    return meeting.participants.joined.toArray();
  } catch (e) {
    console.warn('[RTK] Failed to get participants array:', e);
    return [];
  }
}

/**
 * Get all participants including self
 */
export function getAllParticipants(meeting: any): RealtimeKitParticipant[] {
  const participants = getParticipantsArray(meeting);
  if (meeting?.self) {
    return [meeting.self, ...participants];
  }
  return participants;
}

/**
 * Get all participant userIds (for Stage API calls)
 * Based on: https://developers.cloudflare.com/realtime/realtimekit/core/stage-management/
 */
export function getParticipantUserIds(meeting: any): string[] {
  return getParticipantsArray(meeting).map((p: RealtimeKitParticipant) => p.userId);
}

/**
 * Get a specific participant by their session ID
 * Use meeting.participants.joined.get() for single lookups
 */
export function getParticipantById(meeting: any, participantId: string): RealtimeKitParticipant | undefined {
  if (!meeting?.participants?.joined) return undefined;
  try {
    return meeting.participants.joined.get(participantId);
  } catch (e) {
    return undefined;
  }
}

/**
 * Get participants by preset/role
 */
export function getParticipantsByPreset(meeting: any, preset: string): RealtimeKitParticipant[] {
  return getParticipantsArray(meeting).filter(
    (p: RealtimeKitParticipant) => p.presetName?.toLowerCase() === preset.toLowerCase()
  );
}

/**
 * Get participants who are on stage (speakers/hosts)
 */
export function getOnStageParticipants(meeting: any): RealtimeKitParticipant[] {
  return getParticipantsArray(meeting).filter(
    (p: RealtimeKitParticipant) => p.stageStatus === STAGE_STATUS.ON_STAGE
  );
}

/**
 * Get participants who are off stage (listeners)
 */
export function getOffStageParticipants(meeting: any): RealtimeKitParticipant[] {
  return getParticipantsArray(meeting).filter(
    (p: RealtimeKitParticipant) => p.stageStatus === STAGE_STATUS.OFF_STAGE
  );
}

/**
 * Get pending stage requests
 */
export function getPendingStageRequests(meeting: any): RealtimeKitParticipant[] {
  return getParticipantsArray(meeting).filter(
    (p: RealtimeKitParticipant) => p.stageStatus === STAGE_STATUS.REQUESTED_TO_JOIN_STAGE
  );
}

/**
 * Sort participants by role priority
 */
export function sortParticipantsByRole(participants: RealtimeKitParticipant[]): RealtimeKitParticipant[] {
  return [...participants].sort((a, b) => {
    const roleA = a.presetName?.toLowerCase() || 'listener';
    const roleB = b.presetName?.toLowerCase() || 'listener';
    return (ROLE_PRIORITY[roleA] || 5) - (ROLE_PRIORITY[roleB] || 5);
  });
}

/**
 * Check if local participant has permission to mute others
 */
export function canMuteOthers(meeting: any): boolean {
  return meeting?.self?.permissions?.canDisableParticipantAudio ?? false;
}

/**
 * Check if local participant has permission to kick others
 */
export function canKickParticipants(meeting: any): boolean {
  return meeting?.self?.permissions?.kickParticipant ?? false;
}

/**
 * Check if local participant can accept stage requests
 */
export function canAcceptStageRequests(meeting: any): boolean {
  return meeting?.self?.permissions?.canAcceptStageRequests ?? false;
}

/**
 * Check if local participant can produce audio
 */
export function canProduceAudio(meeting: any): boolean {
  return meeting?.self?.permissions?.produceAudio ?? false;
}

/**
 * Get participant's role/preset name
 * Returns 'listener' if participant is null or undefined
 */
export function getParticipantRole(participant: RealtimeKitParticipant | null | undefined): string {
  if (!participant) return 'listener';
  return participant.presetName?.toLowerCase() || 'listener';
}

/**
 * Check if participant is host or co-host
 * Returns false if participant is null or undefined
 */
export function isHostOrCohost(participant: RealtimeKitParticipant | null | undefined): boolean {
  if (!participant) return false;
  const role = getParticipantRole(participant);
  return role === 'host' || role === 'co-host';
}

// ============================================
// Custom Hooks
// ============================================

/**
 * Hook to get all participants with automatic updates
 * Replaces: useHMSStore(selectPeers)
 */
export function useParticipants(meeting: any) {
  const [participants, setParticipants] = useState<RealtimeKitParticipant[]>([]);

  useEffect(() => {
    if (!meeting?.participants?.joined) {
      setParticipants([]);
      return;
    }

    // Initial load
    setParticipants(getAllParticipants(meeting));

    // Listen for participant changes
    const handleParticipantJoined = () => {
      setParticipants(getAllParticipants(meeting));
    };

    const handleParticipantLeft = () => {
      setParticipants(getAllParticipants(meeting));
    };

    meeting.participants.joined.on('participantJoined', handleParticipantJoined);
    meeting.participants.joined.on('participantLeft', handleParticipantLeft);

    return () => {
      meeting.participants.joined.off('participantJoined', handleParticipantJoined);
      meeting.participants.joined.off('participantLeft', handleParticipantLeft);
    };
  }, [meeting]);

  return useMemo(() => sortParticipantsByRole(participants), [participants]);
}

/**
 * Hook to get local participant (self)
 * Replaces: useHMSStore(selectLocalPeer)
 */
export function useLocalParticipant(meeting: any): RealtimeKitSelf | null {
  const [self, setSelf] = useState<RealtimeKitSelf | null>(null);

  useEffect(() => {
    if (!meeting?.self) {
      setSelf(null);
      return;
    }

    setSelf(meeting.self);

    // Listen for self updates
    const handleSelfUpdate = () => {
      setSelf({ ...meeting.self });
    };

    meeting.self.on('audioUpdate', handleSelfUpdate);
    meeting.self.on('videoUpdate', handleSelfUpdate);

    return () => {
      meeting.self.off('audioUpdate', handleSelfUpdate);
      meeting.self.off('videoUpdate', handleSelfUpdate);
    };
  }, [meeting]);

  return self;
}

/**
 * Hook for audio toggle
 * Replaces: useAVToggle()
 */
export function useAudioToggle(meeting: any) {
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  useEffect(() => {
    if (!meeting?.self) return;

    setIsAudioEnabled(meeting.self.audioEnabled);

    const handleAudioUpdate = () => {
      setIsAudioEnabled(meeting.self.audioEnabled);
    };

    meeting.self.on('audioUpdate', handleAudioUpdate);

    return () => {
      meeting.self.off('audioUpdate', handleAudioUpdate);
    };
  }, [meeting]);

  const toggleAudio = useCallback(async () => {
    if (!meeting?.self) return;

    try {
      if (meeting.self.audioEnabled) {
        await meeting.self.disableAudio();
      } else {
        await meeting.self.enableAudio();
      }
    } catch (err) {
      console.error('[RTK] Audio toggle error:', err);
    }
  }, [meeting]);

  return {
    isLocalAudioEnabled: isAudioEnabled,
    toggleAudio,
  };
}

/**
 * Hook for connection state
 * Replaces: useHMSStore(selectIsConnectedToRoom)
 */
export function useConnectionState(meeting: any) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!meeting?.self) {
      setIsConnected(false);
      return;
    }

    const handleRoomJoined = () => {
      setIsConnected(true);
    };

    const handleRoomLeft = () => {
      setIsConnected(false);
    };

    meeting.self.on('roomJoined', handleRoomJoined);
    meeting.self.on('roomLeft', handleRoomLeft);

    return () => {
      meeting.self.off('roomJoined', handleRoomJoined);
      meeting.self.off('roomLeft', handleRoomLeft);
    };
  }, [meeting]);

  return isConnected;
}

/**
 * Hook for stage requests (hand raise)
 * Replaces: HMSNotificationTypes.HAND_RAISE_CHANGED
 */
export function useStageRequests(meeting: any) {
  const [requests, setRequests] = useState<StageRequest[]>([]);

  useEffect(() => {
    if (!meeting?.stage) return;

    const handleNewRequest = (participant: any) => {
      const newRequest: StageRequest = {
        id: participant.id,
        peerId: participant.id,
        userId: participant.userId,
        displayName: participant.name || 'Unknown',
        picture: participant.picture,
        timestamp: new Date().toISOString(),
      };

      setRequests(prev => {
        if (prev.some(r => r.userId === newRequest.userId)) return prev;
        return [...prev, newRequest];
      });
    };

    const handleRequestApproved = (participant: any) => {
      setRequests(prev => prev.filter(r => r.userId !== participant.userId));
    };

    const handleRequestRejected = (participant: any) => {
      setRequests(prev => prev.filter(r => r.userId !== participant.userId));
    };

    meeting.stage.on('newStageRequest', handleNewRequest);
    meeting.stage.on('stageRequestApproved', handleRequestApproved);
    meeting.stage.on('stageRequestRejected', handleRequestRejected);

    return () => {
      meeting.stage.off('newStageRequest', handleNewRequest);
      meeting.stage.off('stageRequestApproved', handleRequestApproved);
      meeting.stage.off('stageRequestRejected', handleRequestRejected);
    };
  }, [meeting]);

  const grantAccess = useCallback(async (userIds: string[]) => {
    if (!meeting?.stage) return;
    try {
      await meeting.stage.grantAccess(userIds);
    } catch (err) {
      console.error('[RTK] Grant access error:', err);
    }
  }, [meeting]);

  const denyAccess = useCallback(async (userIds: string[]) => {
    if (!meeting?.stage) return;
    try {
      await meeting.stage.denyAccess(userIds);
    } catch (err) {
      console.error('[RTK] Deny access error:', err);
    }
  }, [meeting]);

  const requestAccess = useCallback(async () => {
    if (!meeting?.stage) {
      console.warn('[RTK] Stage management not available - may need to enable in RealtimeKit presets');
      return;
    }
    try {
      await meeting.stage.requestAccess();
    } catch (err: any) {
      // Log more context about the error
      if (err?.message?.includes('disabled') || err?.message?.includes('not enabled')) {
        console.warn('[RTK] Stage management is disabled in this preset');
      } else {
        console.error('[RTK] Request access error:', err);
      }
      throw err; // Re-throw so caller can handle
    }
  }, [meeting]);

  const kickFromStage = useCallback(async (userIds: string[]) => {
    if (!meeting?.stage) return;
    try {
      await meeting.stage.kick(userIds);
    } catch (err) {
      console.error('[RTK] Kick from stage error:', err);
    }
  }, [meeting]);

  return {
    requests,
    grantAccess,
    denyAccess,
    requestAccess,
    kickFromStage,
  };
}

/**
 * Hook for participant moderation actions
 */
export function useParticipantActions(meeting: any) {
  const muteParticipant = useCallback(async (participantId: string) => {
    if (!meeting?.participants?.joined) return;
    try {
      const participant = meeting.participants.joined.get(participantId);
      if (participant) {
        await participant.disableAudio();
      }
    } catch (err) {
      console.error('[RTK] Mute participant error:', err);
    }
  }, [meeting]);

  const kickParticipant = useCallback(async (participantId: string) => {
    if (!meeting?.participants?.joined) return;
    try {
      const participant = meeting.participants.joined.get(participantId);
      if (participant) {
        await participant.kick();
      }
    } catch (err) {
      console.error('[RTK] Kick participant error:', err);
    }
  }, [meeting]);

  const kickAll = useCallback(async () => {
    if (!meeting?.participants) return;
    try {
      await meeting.participants.kickAll();
    } catch (err) {
      console.error('[RTK] Kick all error:', err);
    }
  }, [meeting]);

  return {
    muteParticipant,
    kickParticipant,
    kickAll,
  };
}

// ============================================
// Stage Management Types and Hooks
// ============================================

/**
 * Hook for advanced Stage Management operations
 * 
 * This extends useStageRequests with additional functionality for:
 * - Role/preset changes via Stage Management
 * - Stage status tracking
 * - Integration with backend preset changes
 * 
 * Based on: https://developers.cloudflare.com/realtime/realtimekit/core/stage-management/
 * 
 * Key concepts:
 * - ON_STAGE: Participant can produce audio/video (speakers, hosts)
 * - OFF_STAGE: Participant can only consume (listeners)
 * - Stage APIs use userId (persistent), not id (session)
 */
export function useStageManagement(meeting: any) {
  const [localStageStatus, setLocalStageStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!meeting?.self) return;

    // Track local stage status
    setLocalStageStatus(meeting.self.stageStatus || null);

    const handleStageStatusUpdate = () => {
      setLocalStageStatus(meeting.self.stageStatus);
    };

    meeting.self.on('stageStatusUpdate', handleStageStatusUpdate);

    return () => {
      meeting.self.off('stageStatusUpdate', handleStageStatusUpdate);
    };
  }, [meeting]);

  /**
   * Request to join stage (listener wants to become speaker)
   * This triggers a newStageRequest event for hosts
   */
  const requestToJoinStage = useCallback(async () => {
    if (!meeting?.stage) return;
    try {
      await meeting.stage.requestAccess();
      console.log('[RTK Stage] Stage access requested');
    } catch (err) {
      console.error('[RTK Stage] Request access error:', err);
      throw err;
    }
  }, [meeting]);

  /**
   * Accept a stage request (host/co-host action)
   * Uses userId array, not participant id
   */
  const acceptStageRequest = useCallback(async (userIds: string[]) => {
    if (!meeting?.stage) return;
    try {
      await meeting.stage.grantAccess(userIds);
      console.log('[RTK Stage] Access granted to:', userIds);
    } catch (err) {
      console.error('[RTK Stage] Grant access error:', err);
      throw err;
    }
  }, [meeting]);

  /**
   * Reject a stage request (host/co-host action)
   */
  const rejectStageRequest = useCallback(async (userIds: string[]) => {
    if (!meeting?.stage) return;
    try {
      await meeting.stage.denyAccess(userIds);
      console.log('[RTK Stage] Access denied to:', userIds);
    } catch (err) {
      console.error('[RTK Stage] Deny access error:', err);
      throw err;
    }
  }, [meeting]);

  /**
   * Remove from stage (demote speaker to listener)
   */
  const removeFromStage = useCallback(async (userIds: string[]) => {
    if (!meeting?.stage) return;
    try {
      await meeting.stage.kick(userIds);
      console.log('[RTK Stage] Kicked from stage:', userIds);
    } catch (err) {
      console.error('[RTK Stage] Kick from stage error:', err);
      throw err;
    }
  }, [meeting]);

  /**
   * Leave stage voluntarily (speaker demotes self to listener)
   */
  const leaveStage = useCallback(async () => {
    if (!meeting?.stage) return;
    try {
      await meeting.stage.leave();
      console.log('[RTK Stage] Left stage');
    } catch (err) {
      console.error('[RTK Stage] Leave stage error:', err);
      throw err;
    }
  }, [meeting]);

  /**
   * Join stage (after request was approved)
   */
  const joinStage = useCallback(async () => {
    if (!meeting?.stage) return;
    try {
      await meeting.stage.join();
      console.log('[RTK Stage] Joined stage');
    } catch (err) {
      console.error('[RTK Stage] Join stage error:', err);
      throw err;
    }
  }, [meeting]);

  /**
   * Check if local user is on stage
   */
  const isOnStage = localStageStatus === STAGE_STATUS.ON_STAGE;

  /**
   * Check if local user has pending request
   */
  const hasPendingRequest = localStageStatus === STAGE_STATUS.REQUESTED_TO_JOIN_STAGE;

  /**
   * Check if local user's request was accepted (needs to call joinStage)
   */
  const isAcceptedToJoin = localStageStatus === STAGE_STATUS.ACCEPTED_TO_JOIN_STAGE;

  return {
    localStageStatus,
    isOnStage,
    hasPendingRequest,
    isAcceptedToJoin,
    requestToJoinStage,
    acceptStageRequest,
    rejectStageRequest,
    removeFromStage,
    leaveStage,
    joinStage,
  };
}

/**
 * Hook to listen for stage events (for hosts to manage speakers)
 */
export function useStageEvents(meeting: any) {
  const [pendingRequests, setPendingRequests] = useState<StageRequest[]>([]);

  useEffect(() => {
    if (!meeting?.stage) return;

    const handleNewRequest = (event: any) => {
      const participant = event.participant || event;
      const request: StageRequest = {
        id: participant.id || `req_${Date.now()}`,
        peerId: participant.id,
        userId: participant.userId,
        displayName: participant.name || 'Unknown',
        picture: participant.picture,
        timestamp: new Date().toISOString(),
      };

      setPendingRequests(prev => {
        if (prev.some(r => r.userId === request.userId)) return prev;
        return [...prev, request];
      });
    };

    const handleRequestApproved = (event: any) => {
      const userId = event.userId || event.participant?.userId;
      setPendingRequests(prev => prev.filter(r => r.userId !== userId));
    };

    const handleRequestRejected = (event: any) => {
      const userId = event.userId || event.participant?.userId;
      setPendingRequests(prev => prev.filter(r => r.userId !== userId));
    };

    const handleStageLeft = (event: any) => {
      const userId = event.userId || event.participant?.userId;
      setPendingRequests(prev => prev.filter(r => r.userId !== userId));
    };

    meeting.stage.on('newStageRequest', handleNewRequest);
    meeting.stage.on('stageRequestApproved', handleRequestApproved);
    meeting.stage.on('stageRequestRejected', handleRequestRejected);
    meeting.stage.on('stageLeft', handleStageLeft);

    return () => {
      meeting.stage.off('newStageRequest', handleNewRequest);
      meeting.stage.off('stageRequestApproved', handleRequestApproved);
      meeting.stage.off('stageRequestRejected', handleRequestRejected);
      meeting.stage.off('stageLeft', handleStageLeft);
    };
  }, [meeting]);

  return {
    pendingRequests,
    clearRequest: (userId: string) => {
      setPendingRequests(prev => prev.filter(r => r.userId !== userId));
    },
  };
}

// ============================================
// Chat Types and Hooks
// ============================================

export interface ChatMessage {
  id: string;
  participantId: string;
  displayName: string;
  message: string;
  time: Date;
  type: 'text' | 'file' | 'image';
}

/**
 * Hook for chat functionality
 * Replaces: selectHMSMessages, hmsActions.sendBroadcastMessage
 * 
 * Based on: https://docs.realtime.cloudflare.com/web-core/chat/sending-a-chat-message
 * - Broadcast: meeting.chat.sendTextMessage(text)
 * - Private: meeting.chat.sendMessage(messageObj, participantIds)
 * - Receive: meeting.chat.on('chatUpdate', callback)
 */
export function useChat(meeting: any) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!meeting?.chat) return;

    // Handle incoming chat messages
    const handleChatUpdate = (message: any) => {
      const newMessage: ChatMessage = {
        id: message.id || `msg_${Date.now()}`,
        participantId: message.userId || message.participantId || '',
        displayName: message.displayName || message.name || 'Unknown',
        message: message.message || message.text || '',
        time: new Date(message.time || message.timestamp || Date.now()),
        type: message.type || 'text',
      };

      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    };

    meeting.chat.on('chatUpdate', handleChatUpdate);

    return () => {
      meeting.chat.off('chatUpdate', handleChatUpdate);
    };
  }, [meeting]);

  /**
   * Send broadcast text message to everyone
   * Based on: meeting.chat.sendTextMessage("Hello World!")
   */
  const sendBroadcastMessage = useCallback(async (text: string) => {
    if (!meeting?.chat || !text.trim()) return;

    try {
      await meeting.chat.sendTextMessage(text);
    } catch (err) {
      console.error('[RTK] Send broadcast message error:', err);
      throw err;
    }
  }, [meeting]);

  /**
   * Send private message to specific participants
   * Based on: meeting.chat.sendMessage(messageObj, participantIds)
   * 
   * @param message - Message object { type: 'text', message: '...' }
   * @param participantIds - Array of participant IDs to send to
   */
  const sendPrivateMessage = useCallback(async (
    messageText: string, 
    participantIds: string[]
  ) => {
    if (!meeting?.chat || !messageText.trim() || participantIds.length === 0) return;

    try {
      const messageObj = {
        type: 'text',
        message: messageText,
      };
      await meeting.chat.sendMessage(messageObj, participantIds);
    } catch (err) {
      console.error('[RTK] Send private message error:', err);
      throw err;
    }
  }, [meeting]);

  /**
   * Clear local message state
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendBroadcastMessage,
    sendPrivateMessage,
    clearMessages,
  };
}

// ============================================
// Re-exports
// ============================================

export { useRealtimeKitMeeting, useRealtimeKitSelector };

