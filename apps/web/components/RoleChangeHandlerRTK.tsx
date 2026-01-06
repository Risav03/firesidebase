'use client'

/**
 * RoleChangeHandlerRTK - RealtimeKit version of RoleChangeHandler
 * 
 * Handles automatic role/preset changes when a participant's stage status changes.
 * 
 * In RealtimeKit, role changes happen via Stage Management:
 * - When accepted to stage → ACCEPTED_TO_JOIN_STAGE → should call stage.join()
 * - When kicked from stage → moves to OFF_STAGE
 * - When granted stage access → can produce audio/video
 * 
 * Unlike 100ms which required re-joining with a new token, RealtimeKit's
 * Stage Management handles permissions dynamically without reconnection.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRealtimeKit } from '@/utils/providers/realtimekit';
import { 
  useLocalParticipant,
  useStageManagement,
  STAGE_STATUS,
} from '@/utils/providers/realtimekit-hooks';
import { toast } from 'react-toastify';

export default function RoleChangeHandlerRTK() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { meeting } = useRealtimeKit();
  const localParticipant = useLocalParticipant(meeting);
  const { 
    localStageStatus, 
    isAcceptedToJoin,
    joinStage 
  } = useStageManagement(meeting);
  
  const lastStageStatus = useRef<string | null>(null);
  const isTransitioning = useRef(false);

  /**
   * Auto-join stage when request is accepted
   * 
   * Flow:
   * 1. User raises hand → stage.requestAccess() → REQUESTED_TO_JOIN_STAGE
   * 2. Host approves → stage.grantAccess([userId]) → ACCEPTED_TO_JOIN_STAGE
   * 3. This handler detects ACCEPTED and calls stage.join() → ON_STAGE
   */
  const handleStageAccepted = useCallback(async () => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;

    try {
      console.log('[RoleChangeHandlerRTK] Stage access accepted, joining stage...');
      await joinStage();
      toast.success('You are now a speaker!');
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('role_change_event', {
        detail: { type: 'role_change_complete', newRole: 'speaker' }
      }));
    } catch (error) {
      console.error('[RoleChangeHandlerRTK] Error joining stage:', error);
      toast.error('Failed to join as speaker. Please try again.');
      
      window.dispatchEvent(new CustomEvent('role_change_event', {
        detail: { type: 'role_change_failed', error: error instanceof Error ? error.message : 'Unknown error' }
      }));
    } finally {
      isTransitioning.current = false;
    }
  }, [joinStage]);

  // Listen for stage status changes
  useEffect(() => {
    if (!meeting?.self || !localStageStatus) return;

    // Check if status changed
    if (lastStageStatus.current === localStageStatus) return;
    
    const previousStatus = lastStageStatus.current;
    lastStageStatus.current = localStageStatus;

    console.log(`[RoleChangeHandlerRTK] Stage status changed: ${previousStatus} → ${localStageStatus}`);

    // Handle accepted to join stage
    if (localStageStatus === STAGE_STATUS.ACCEPTED_TO_JOIN_STAGE) {
      handleStageAccepted();
    }

    // Handle kicked from stage (demoted to listener)
    if (previousStatus === STAGE_STATUS.ON_STAGE && localStageStatus === STAGE_STATUS.OFF_STAGE) {
      toast.info('You have been moved to the audience.');
      
      window.dispatchEvent(new CustomEvent('role_change_event', {
        detail: { type: 'role_change_complete', newRole: 'listener' }
      }));
    }

    // Handle request denied
    if (previousStatus === STAGE_STATUS.REQUESTED_TO_JOIN_STAGE && localStageStatus === STAGE_STATUS.OFF_STAGE) {
      toast.info('Your speaker request was not approved.');
    }

  }, [meeting, localStageStatus, handleStageAccepted]);

  // Listen for preset/permission changes (for co-host/host promotions via backend)
  useEffect(() => {
    if (!meeting?.self) return;

    const handlePermissionsUpdate = () => {
      console.log('[RoleChangeHandlerRTK] Permissions updated');
      // Permissions are updated dynamically, no need to rejoin
    };

    meeting.self.on('permissionsUpdate', handlePermissionsUpdate);

    return () => {
      meeting.self.off('permissionsUpdate', handlePermissionsUpdate);
    };
  }, [meeting]);

  // This component doesn't render anything
  return null;
}

