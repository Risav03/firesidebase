"use client";

/**
 * FooterRTK - RealtimeKit version of Footer
 * 
 * Key changes from 100ms version:
 * - Uses useAudioToggle() hook instead of useAVToggle()
 * - Uses useLocalParticipant() instead of selectLocalPeer
 * - Uses useStageRequests() for hand raise via Stage Management
 * - Uses meeting.self.permissions for permission checks
 */

import { useState } from "react";
import { useRealtimeKit } from "@/utils/providers/realtimekit";
import { 
  useAudioToggle, 
  useLocalParticipant,
  useStageRequests,
  canProduceAudio 
} from "@/utils/providers/realtimekit-hooks";
import { useGlobalContext } from "../utils/providers/globalContext";
// Use RTK stubs instead of 100ms versions (pending Phase 6 & 8 migration)
import { useEmojiReactionLogicRTK } from "./footer/useEmojiReactionLogicRTK";
import { useSoundboardLogicRTK } from "./footer/useSoundboardLogicRTK";
import { ControlCenterDrawer } from "./experimental";
import ChatRTK from "./ChatRTK";
import TippingModal from "./TippingModal";
import EmojiPickerDrawer from "./footer/EmojiPickerDrawer";
import FloatingEmojis from "./footer/FloatingEmojis";
import SoundboardDrawer from "./SoundboardDrawer";

export default function FooterRTK({ roomId }: { roomId: string }) {
  const { meeting } = useRealtimeKit();
  const { isLocalAudioEnabled, toggleAudio } = useAudioToggle(meeting);
  const localParticipant = useLocalParticipant(meeting);
  const { requestAccess } = useStageRequests(meeting);

  const { user } = useGlobalContext();
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTippingOpen, setIsTippingOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Use RTK stubs (pending full implementation in Phase 6 & 8)
  const { handleEmojiSelect, floatingEmojis, isDisabled } = useEmojiReactionLogicRTK({ user });
  const soundboardLogic = useSoundboardLogicRTK(user);

  // Check if user can unmute (has audio permission)
  const canUnmute = canProduceAudio(meeting);

  // Handle hand raise using Stage Management
  // Note: Stage management must be enabled in RealtimeKit presets for this to work
  const toggleRaiseHand = async () => {
    if (isHandRaised) {
      // Lower hand - just update local state
      setIsHandRaised(false);
    } else {
      try {
        // Raise hand - request stage access
        await requestAccess();
        setIsHandRaised(true);
      } catch (err) {
        console.warn('[FooterRTK] Hand raise failed (stage may be disabled):', err);
        // Still toggle the visual state for UX feedback
        setIsHandRaised(true);
      }
    }
  };

  const handleReaction = () => {
    setIsEmojiPickerOpen(true);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <ControlCenterDrawer
          open={controlsOpen}
          setOpen={setControlsOpen}
          muted={!isLocalAudioEnabled}
          setMuted={(muted) => {
            if (muted && isLocalAudioEnabled && toggleAudio) {
              toggleAudio();
            } else if (!muted && !isLocalAudioEnabled && canUnmute && toggleAudio) {
              toggleAudio();
            }
          }}
          handUp={isHandRaised}
          setHandUp={(up) => {
            if (up !== isHandRaised) {
              toggleRaiseHand();
            }
          }}
          onReact={handleReaction}
          onChat={() => setIsChatOpen(true)}
          onTip={() => setIsTippingOpen(true)}
          onSoundboard={() => setIsSoundboardOpen(true)}
          onVisibleHeightChange={(h) => {
            // Optional: track drawer height if needed
          }}
        />
      </div>
      
      <FloatingEmojis emojis={floatingEmojis} />
      
      <ChatRTK
        isOpen={isChatOpen}
        setIsChatOpen={() => setIsChatOpen(!isChatOpen)}
        roomId={roomId}
      />
      
      <TippingModal
        isOpen={isTippingOpen}
        onClose={() => setIsTippingOpen(false)}
        roomId={roomId}
      />
      
      <EmojiPickerDrawer
        isOpen={isEmojiPickerOpen}
        onEmojiSelect={handleEmojiSelect}
        onClose={() => setIsEmojiPickerOpen(false)}
        isDisabled={isDisabled}
      />
      
      <SoundboardDrawer
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
        {...soundboardLogic}
      />
    </>
  );
}

