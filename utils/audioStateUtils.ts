import { HMSActions, HMSPeer } from '@100mslive/react-sdk';

/**
 * Utility functions for managing and recovering audio states
 */

export interface AudioStateSnapshot {
  peerId: string;
  peerName: string;
  audioEnabled: boolean;
  timestamp: string;
}

/**
 * Creates a snapshot of all peers' audio states
 */
export function createAudioStateSnapshot(peers: HMSPeer[]): AudioStateSnapshot[] {
  return peers.map(peer => ({
    peerId: peer.id,
    peerName: peer.name || 'Unknown',
    audioEnabled: !!peer.audioTrack, // Note: Use selectIsPeerAudioEnabled for accurate state
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Compares two audio state snapshots and returns differences
 */
export function compareAudioStates(
  previousSnapshot: AudioStateSnapshot[],
  currentSnapshot: AudioStateSnapshot[]
): {
  changed: Array<{
    peerId: string;
    peerName: string;
    previousState: boolean;
    currentState: boolean;
  }>;
  unexpectedMutes: Array<{
    peerId: string;
    peerName: string;
  }>;
} {
  const changed: Array<{
    peerId: string;
    peerName: string;
    previousState: boolean;
    currentState: boolean;
  }> = [];
  
  const unexpectedMutes: Array<{
    peerId: string;
    peerName: string;
  }> = [];

  const previousMap = new Map(previousSnapshot.map(s => [s.peerId, s]));

  currentSnapshot.forEach(current => {
    const previous = previousMap.get(current.peerId);
    
    if (previous && previous.audioEnabled !== current.audioEnabled) {
      changed.push({
        peerId: current.peerId,
        peerName: current.peerName,
        previousState: previous.audioEnabled,
        currentState: current.audioEnabled,
      });

      // Check for unexpected muting (was enabled, now disabled)
      if (previous.audioEnabled && !current.audioEnabled) {
        unexpectedMutes.push({
          peerId: current.peerId,
          peerName: current.peerName,
        });
      }
    }
  });

  return { changed, unexpectedMutes };
}

/**
 * Attempts to recover audio state for a peer
 */
export async function attemptAudioStateRecovery(
  hmsActions: HMSActions,
  peer: HMSPeer,
  expectedState: boolean
): Promise<boolean> {
  try {
    console.log('[Audio Recovery] Attempting to recover audio state', {
      peerId: peer.id,
      peerName: peer.name,
      currentState: !!peer.audioTrack, // Note: Use selectIsPeerAudioEnabled for accurate state
      expectedState,
      timestamp: new Date().toISOString(),
    });

    if (!peer.audioTrack) {
      console.warn('[Audio Recovery] No audio track available for peer', {
        peerId: peer.id,
        peerName: peer.name,
      });
      return false;
    }

    // For local peer, use the toggle function if available
    if (peer.isLocal) {
      // This would need to be passed in from the component that has access to toggleAudio
      console.log('[Audio Recovery] Cannot recover local peer audio state from utility function');
      return false;
    }

    // For remote peers, use setRemoteTrackEnabled
    await hmsActions.setRemoteTrackEnabled(peer.audioTrack, expectedState);
    
    console.log('[Audio Recovery] Audio state recovery completed', {
      peerId: peer.id,
      peerName: peer.name,
      recoveredState: expectedState,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error('[Audio Recovery] Failed to recover audio state', {
      peerId: peer.id,
      peerName: peer.name,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
    return false;
  }
}

/**
 * Validates that audio states are consistent with role permissions
 */
export function validateAudioStatesWithRoles(peers: HMSPeer[]): {
  inconsistencies: Array<{
    peerId: string;
    peerName: string;
    role: string;
    hasAudioTrack: boolean;
    audioEnabled: boolean;
    shouldHaveAudio: boolean;
    issue: string;
  }>;
} {
  const inconsistencies: Array<{
    peerId: string;
    peerName: string;
    role: string;
    hasAudioTrack: boolean;
    audioEnabled: boolean;
    shouldHaveAudio: boolean;
    issue: string;
  }> = [];

  peers.forEach(peer => {
    const role = peer.roleName?.toLowerCase() || 'listener';
    const hasAudioTrack = !!peer.audioTrack;
    const audioEnabled = !!peer.audioTrack; // Note: Use selectIsPeerAudioEnabled for accurate state
    
    // Define which roles should have audio capabilities
    const shouldHaveAudio = ['host', 'co-host', 'speaker'].includes(role);

    let issue = '';
    
    if (shouldHaveAudio && !hasAudioTrack) {
      issue = 'Missing audio track for speaking role';
    } else if (!shouldHaveAudio && hasAudioTrack && audioEnabled) {
      issue = 'Listener has enabled audio track';
    }

    if (issue) {
      inconsistencies.push({
        peerId: peer.id,
        peerName: peer.name || 'Unknown',
        role,
        hasAudioTrack,
        audioEnabled,
        shouldHaveAudio,
        issue,
      });
    }
  });

  return { inconsistencies };
}

/**
 * Debounced function creator to prevent rapid successive calls
 */
export function createDebouncedFunction<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  }) as T;
}
