"use client";

import { useState } from "react";
import {
  selectIsAllowedToPublish,
  useAVToggle,
  useHMSStore,
  selectLocalPeerID,
  selectHasPeerHandRaised,
  selectLocalPeer,
} from "@100mslive/react-sdk";
import { useGlobalContext } from "../utils/providers/globalContext";
import { useHandRaiseLogic } from "./footer/useHandRaiseLogic";
import { useEmojiReactionLogic } from "./footer/useEmojiReactionLogic";
import { useSoundboardLogic } from "./footer/useSoundboardLogic";
import { ControlCenterDrawer } from "./experimental";
import Chat from "./Chat";
import TippingModal from "./TippingModal";
import EmojiPickerDrawer from "./footer/EmojiPickerDrawer";
import FloatingEmojis from "./footer/FloatingEmojis";
import SoundboardDrawer from "./SoundboardDrawer";

export default function Footer({ roomId }: { roomId: string }) {
  const { isLocalAudioEnabled, toggleAudio } = useAVToggle((err) => {
    console.error("[HMS] useAVToggle error:", err);
  });
  const localPeer = useHMSStore(selectLocalPeer);
  const publishPermissions = useHMSStore(selectIsAllowedToPublish);
  const localPeerId = useHMSStore(selectLocalPeerID);
  const isHandRaised = useHMSStore(selectHasPeerHandRaised(localPeerId));

  const { user } = useGlobalContext();
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTippingOpen, setIsTippingOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);

  const { toggleRaiseHand } = useHandRaiseLogic({
    isHandRaised,
    localPeerId,
  });

  const { handleEmojiSelect, floatingEmojis, isDisabled } = useEmojiReactionLogic({ user });

  const soundboardLogic = useSoundboardLogic(user);

  const canUnmute = Boolean(publishPermissions?.audio && toggleAudio);

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
      
      <Chat
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
