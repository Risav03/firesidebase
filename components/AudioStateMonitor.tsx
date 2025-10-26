"use client";

import { useEffect, useRef } from 'react';
import { 
  useHMSStore, 
  selectPeers, 
  selectLocalPeer,
  useHMSNotifications,
  HMSNotificationTypes,
  selectIsPeerAudioEnabled
} from '@100mslive/react-sdk';

/**
 * AudioStateMonitor - A debugging component to monitor and log audio state changes
 * This component helps identify when audio states become desynchronized
 */
export default function AudioStateMonitor() {
  const allPeers = useHMSStore(selectPeers);
  const localPeer = useHMSStore(selectLocalPeer);
  const notification = useHMSNotifications();
  
  // Keep track of previous audio states to detect changes
  const previousAudioStatesRef = useRef<Map<string, boolean>>(new Map());
  const audioStateHistoryRef = useRef<Array<{
    timestamp: string;
    peerId: string;
    peerName: string;
    audioEnabled: boolean;
    eventType: string;
    triggerSource?: string;
  }>>([]);

  // Monitor audio state changes
  useEffect(() => {
    const currentAudioStates = new Map<string, boolean>();
    const changes: Array<{
      peerId: string;
      peerName: string;
      previousState: boolean;
      currentState: boolean;
    }> = [];

    // Check each peer's audio state - using basic track existence for now
    // Note: For accurate state, individual components should use selectIsPeerAudioEnabled
    allPeers.forEach(peer => {
      const currentAudioState = !!peer.audioTrack; // Basic track existence check
      const previousAudioState = previousAudioStatesRef.current.get(peer.id);
      
      currentAudioStates.set(peer.id, currentAudioState);
      
      // Detect changes
      if (previousAudioState !== undefined && previousAudioState !== currentAudioState) {
        changes.push({
          peerId: peer.id,
          peerName: peer.name || 'Unknown',
          previousState: previousAudioState,
          currentState: currentAudioState,
        });

        // Add to history
        audioStateHistoryRef.current.push({
          timestamp: new Date().toISOString(),
          peerId: peer.id,
          peerName: peer.name || 'Unknown',
          audioEnabled: currentAudioState,
          eventType: 'STATE_CHANGE',
          triggerSource: 'PEER_MONITOR',
        });
      }
    });

    // Log any changes detected
    if (changes.length > 0) {
      console.log("[Audio State Monitor] Audio state changes detected:", {
        timestamp: new Date().toISOString(),
        changes,
        totalPeers: allPeers.length,
        localPeerId: localPeer?.id,
        localPeerName: localPeer?.name,
      });

      // Check for suspicious patterns (multiple peers changing at once)
      if (changes.length > 1) {
        console.warn("[Audio State Monitor] SUSPICIOUS: Multiple peers changed audio state simultaneously", {
          timestamp: new Date().toISOString(),
          changeCount: changes.length,
          changes,
          possibleRaceCondition: true,
        });
      }

      // Check for unexpected muting (peer was enabled, now disabled without explicit action)
      const unexpectedMutes = changes.filter(change => 
        change.previousState === true && change.currentState === false
      );
      
      if (unexpectedMutes.length > 0) {
        console.warn("[Audio State Monitor] UNEXPECTED MUTING detected:", {
          timestamp: new Date().toISOString(),
          unexpectedMutes,
          recentHistory: audioStateHistoryRef.current.slice(-10), // Last 10 events
        });
      }
    }

    // Update the reference for next comparison
    previousAudioStatesRef.current = currentAudioStates;

    // Keep history manageable (last 100 events)
    if (audioStateHistoryRef.current.length > 100) {
      audioStateHistoryRef.current = audioStateHistoryRef.current.slice(-100);
    }
  }, [allPeers, localPeer]);

  // Monitor HMS notifications for audio events
  useEffect(() => {
    if (!notification) return;

    const audioRelatedEvents = [
      'TRACK_ADDED',
      'TRACK_REMOVED', 
      'TRACK_MUTED',
      'TRACK_UNMUTED',
      'PEER_JOINED',
      'PEER_LEFT',
      'ROLE_UPDATED'
    ];

    if (audioRelatedEvents.includes(notification.type)) {
      console.log("[Audio State Monitor] HMS Audio Event:", {
        timestamp: new Date().toISOString(),
        eventType: notification.type,
        notificationData: notification.data,
        localPeerId: localPeer?.id,
      });

      // Add to history with simplified data structure
      audioStateHistoryRef.current.push({
        timestamp: new Date().toISOString(),
        peerId: 'unknown', // We'll get the actual peer ID from the data if available
        peerName: 'Unknown',
        audioEnabled: false, // We'll determine this from the event type
        eventType: notification.type,
        triggerSource: 'HMS_NOTIFICATION',
      });
    }
  }, [notification, localPeer]);

  // Periodic audio state validation (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentStates = allPeers.map(peer => ({
        id: peer.id,
        name: peer.name,
        role: peer.roleName,
        audioTrackExists: !!peer.audioTrack,
        audioEnabled: !!peer.audioTrack, // Basic track existence check
        isLocal: peer.isLocal,
      }));

      console.log("[Audio State Monitor] Periodic State Check:", {
        timestamp: new Date().toISOString(),
        totalPeers: allPeers.length,
        peerStates: currentStates,
        recentHistory: audioStateHistoryRef.current.slice(-5), // Last 5 events
      });

      // Check for peers without audio tracks who should have them
      const peersWithoutAudio = currentStates.filter(peer => 
        (peer.role === 'host' || peer.role === 'co-host' || peer.role === 'speaker') && 
        !peer.audioTrackExists
      );

      if (peersWithoutAudio.length > 0) {
        console.warn("[Audio State Monitor] Peers missing audio tracks:", {
          timestamp: new Date().toISOString(),
          peersWithoutAudio,
        });
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [allPeers]);

  // This component doesn't render anything visible
  return null;
}
