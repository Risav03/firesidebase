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
import EmojiPickerDrawer from "./footer/EmojiPickerDrawer";
import FloatingEmojis from "./footer/FloatingEmojis";
import { useHandRaiseLogic } from "./footer/useHandRaiseLogic";
import { useEmojiReactionLogic } from "./footer/useEmojiReactionLogic";
import { useChatStateLogic } from "./footer/useChatStateLogic";
import { useRejoinState } from "./footer/useRejoinState";
import { useHMSNotificationLogger } from "./footer/useHMSNotificationLogger";

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

  const { isRejoining } = useRejoinState();
  
  const { isChatOpen, unreadCount, handleChatToggle } = useChatStateLogic({
    roomId,
    messages,
    localPeerName: localPeer?.name,
    userFid: user?.fid
  });

  const { toggleRaiseHand, handRaiseDisabled, handRaiseCountdown } = useHandRaiseLogic({
    isHandRaised,
    localPeerId
  });

  const { floatingEmojis, handleEmojiSelect } = useEmojiReactionLogic({ user });

  useHMSNotificationLogger(localPeer, isLocalAudioEnabled);

  const canUnmute = Boolean(publishPermissions?.audio && toggleAudio);

  const handleTippingClick = () => {
    setIsTippingModalOpen((prev) => !prev);
  };

  const isHost = localRoleName === "host" || localRoleName === "co-host";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-28 bg-fireside-dark_orange">
      <div className="max-w-4xl mx-auto px-6 py-4 flex">
        <div className="flex flex-col items-center justify-center w-[30%]">
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

        <div className="flex items-center space-x-2 justify-end w-[70%]">
          <ChatButton 
            isChatOpen={isChatOpen}
            unreadCount={unreadCount}
            onClick={handleChatToggle}
          />

          <HandRaiseButton
            isHandRaised={isHandRaised}
            handRaiseDisabled={handRaiseDisabled}
            handRaiseCountdown={handRaiseCountdown}
            onClick={toggleRaiseHand}
          />

          <EmojiButton onClick={() => setIsEmojiPickerOpen((prev) => !prev)} />

          <TippingButton onClick={handleTippingClick} />
        </div>

        <Chat isOpen={isChatOpen} setIsChatOpen={handleChatToggle} roomId={roomId} />

        <EmojiPickerDrawer 
          isOpen={isEmojiPickerOpen}
          onEmojiSelect={handleEmojiSelect}
        />

        <FloatingEmojis emojis={floatingEmojis} />
      </div>

      <TippingModal
        isOpen={isTippingModalOpen}
        onClose={() => setIsTippingModalOpen(false)}
        roomId={roomId}
      />
    </div>
  );
}