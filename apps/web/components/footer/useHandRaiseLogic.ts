/**
 * @deprecated PENDING MIGRATION TO REALTIMEKIT (Phase 7)
 * 
 * This file uses 100ms hooks for hand raising.
 * 
 * RealtimeKit equivalent:
 * - Use meeting.stage.requestAccess() to raise hand
 * - Use meeting.stage.cancelRequest() to lower hand
 * - Listen to stage events for status updates
 * 
 * See: useStageManagement() in realtimekit-hooks.ts
 * 
 * TODO: This can be replaced with useStageManagement hook
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useHMSActions, HMSActions } from "@100mslive/react-sdk";

interface HandRaiseLogicProps {
  isHandRaised: boolean;
  localPeerId: string;
}

export function useHandRaiseLogic({ isHandRaised, localPeerId }: HandRaiseLogicProps) {
  const hmsActions = useHMSActions();
  const [handRaiseDisabled, setHandRaiseDisabled] = useState(false);
  const [handRaiseCountdown, setHandRaiseCountdown] = useState(10);
  
  const toggleRaiseHand = useCallback(async () => {
    try {
      console.log("[HMS Action] Hand raise toggle initiated", {
        currentState: isHandRaised,
        targetState: !isHandRaised,
        peerId: localPeerId,
        timestamp: new Date().toISOString(),
      });
      
      if (isHandRaised) {
        await hmsActions.lowerLocalPeerHand();
        console.log("[HMS Action] Hand lowered successfully");
      } else if(!isHandRaised && !handRaiseDisabled) {
        await hmsActions.raiseLocalPeerHand();
        console.log("[HMS Action] Hand raised successfully");
        setHandRaiseDisabled(true);
        setHandRaiseCountdown(10);
        
        const countdownInterval = setInterval(() => {
          setHandRaiseCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              setHandRaiseDisabled(false);
              return 10;
            }
            return prev - 1;
          });
        }, 1000);
        
        setTimeout(() => {
          clearInterval(countdownInterval);
          setHandRaiseDisabled(false);
          setHandRaiseCountdown(10);
        }, 10000);
      }
    } catch (error) {
      console.error("[HMS Action] Error toggling hand raise:", error);
    }
  }, [hmsActions, isHandRaised, handRaiseDisabled, localPeerId]);

  return {
    toggleRaiseHand,
    handRaiseDisabled,
    handRaiseCountdown
  };
}
