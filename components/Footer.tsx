"use client";

import { useState } from "react";
import Chat from "./Chat";
import {
  selectIsAllowedToPublish,
  selectLocalPeerRoleName,
  selectHMSMessages,
  useAVToggle,
  useHMSActions,
  useHMSStore,
  selectLocalPeerID,
  selectHasPeerHandRaised,
  selectLocalPeer,
} from "@100mslive/react-sdk";
import { useGlobalContext } from "../utils/providers/globalContext";
import TippingModal from "./TippingModal";
import MicComponent from "./footer/MicComponent";
import ChatButton from "./footer/ChatButton";
import HandRaiseButton from "./footer/HandRaiseButton";
import EmojiButton from "./footer/EmojiButton";
import TippingButton from "./footer/TippingButton";
import SoundboardButton from "./footer/SoundboardButton";
import EmojiPickerDrawer from "./footer/EmojiPickerDrawer";
import FloatingEmojis from "./footer/FloatingEmojis";
import SoundboardDrawer from "./SoundboardDrawer";
import { useHandRaiseLogic } from "./footer/useHandRaiseLogic";
import { useEmojiReactionLogic } from "./footer/useEmojiReactionLogic";
import { useChatStateLogic } from "./footer/useChatStateLogic";
import { useRejoinState } from "./footer/useRejoinState";
import { useHMSNotificationLogger } from "./footer/useHMSNotificationLogger";
import { useSoundboardLogic } from "./footer/useSoundboardLogic";

export default function Footer({ roomId }: { roomId: string }) {
  const { isLocalAudioEnabled, toggleAudio } = useAVToggle((err) => {
    console.error("[HMS] useAVToggle error:", err);
  });
  const hmsActions = useHMSActions();
  const messages = useHMSStore(selectHMSMessages) as Array<any>;
  const localPeer = useHMSStore(selectLocalPeer);
  const publishPermissions = useHMSStore(selectIsAllowedToPublish);
  const localRoleName = useHMSStore(selectLocalPeerRoleName);
  const localPeerId = useHMSStore(selectLocalPeerID);
  const isHandRaised = useHMSStore(selectHasPeerHandRaised(localPeerId));

  const { user } = useGlobalContext();
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isTippingModalOpen, setIsTippingModalOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);

  const { isRejoining } = useRejoinState();

  // Soundboard logic
  const soundboard = useSoundboardLogic(user);

  const { isChatOpen, unreadCount, handleChatToggle } = useChatStateLogic({
    roomId,
    messages,
    localPeerName: localPeer?.name,
    userFid: user?.fid,
  });

  const { toggleRaiseHand, handRaiseDisabled, handRaiseCountdown } =
    useHandRaiseLogic({
      isHandRaised,
      localPeerId,
    });

  const {
    floatingEmojis,
    handleEmojiSelect,
    isDisabled: isEmojiDisabled,
  } = useEmojiReactionLogic({ user });

  useHMSNotificationLogger(localPeer, isLocalAudioEnabled);

  const canUnmute = Boolean(publishPermissions?.audio && toggleAudio);

  const handleTippingClick = () => {
    setIsTippingModalOpen((prev) => !prev);
  };

  const isHost = localRoleName === "host" || localRoleName === "co-host";

  return (
    <div className="fixed rounded-t-lg border-t-2 border-fireside-orange/30 bottom-0 left-0 right-0 z-50 h-28 bg-fireside-darkOrange">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-center h-full">
        <div className="grid grid-cols-2 gap-2 grid-flow-col">
          <EmojiButton
            onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
            className="rounded-lg"
          />

          {/* <SoundboardButton
            onClick={() => setIsSoundboardOpen((prev) => !prev)}
            isPlaying={soundboard.isPlaying}
            disabled={!soundboard.canUse}
          /> */}

          <HandRaiseButton
            isHandRaised={isHandRaised}
            handRaiseDisabled={handRaiseDisabled}
            handRaiseCountdown={handRaiseCountdown}
            onClick={toggleRaiseHand}
          />
        </div>

        <div className="flex flex-col items-center justify-center mx-4">
          <MicComponent
            isLocalAudioEnabled={isLocalAudioEnabled}
            toggleAudio={toggleAudio}
            canUnmute={canUnmute}
            isRejoining={isRejoining}
            localRoleName={localRoleName}
            hmsActions={hmsActions}
            localPeer={localPeer}
            user={user}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 grid-flow-col">
          <TippingButton onClick={handleTippingClick} />
          <ChatButton
            isChatOpen={isChatOpen}
            unreadCount={unreadCount}
            onClick={handleChatToggle}
          />
        </div>

        <Chat
          isOpen={isChatOpen}
          setIsChatOpen={handleChatToggle}
          roomId={roomId}
        />

        <EmojiPickerDrawer
          isOpen={isEmojiPickerOpen}
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setIsEmojiPickerOpen(false)}
          isDisabled={isEmojiDisabled}
        />

        <FloatingEmojis emojis={floatingEmojis} />
      </div>

      <TippingModal
        isOpen={isTippingModalOpen}
        onClose={() => setIsTippingModalOpen(false)}
        roomId={roomId}
      />

      <SoundboardDrawer
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
        playSound={soundboard.playSound}
        stopSound={soundboard.stopSound}
        setVolume={soundboard.setVolume}
        isPlaying={soundboard.isPlaying}
        currentSound={soundboard.currentSound}
        progress={soundboard.progress}
        volume={soundboard.volume}
        cooldownRemaining={soundboard.cooldownRemaining}
        isOnCooldown={soundboard.isOnCooldown}
        availableSounds={soundboard.availableSounds}
        recentSounds={soundboard.recentSounds}
        notifications={soundboard.notifications}
        canUse={soundboard.canUse}
      />
    </div>
  );
}
