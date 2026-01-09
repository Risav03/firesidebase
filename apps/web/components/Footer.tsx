"use client";

import { useState, useEffect } from "react";
import {
  selectIsAllowedToPublish,
  useAVToggle,
  useHMSStore,
  selectLocalPeerID,
  selectHasPeerHandRaised,
  selectLocalPeer,
  useHMSActions,
} from "@100mslive/react-sdk";
import { useGlobalContext } from "../utils/providers/globalContext";
import { useHandRaiseLogic } from "./footer/useHandRaiseLogic";
import { useEmojiReactionLogic } from "./footer/useEmojiReactionLogic";
import { useSoundboardLogic } from "./footer/useSoundboardLogic";
import { useSpeakerRejectionEvent, useSpeakerRequestEvent } from "../utils/events";
import { ControlCenterDrawer } from "./experimental";
import Chat from "./Chat";
import TippingModal from "./TippingModal";
import EmojiPickerDrawer from "./footer/EmojiPickerDrawer";
import FloatingEmojis from "./footer/FloatingEmojis";
import SoundboardDrawer from "./SoundboardDrawer";
import { toast } from "react-toastify";

export default function Footer({ roomId }: { roomId: string }) {
  const { isLocalAudioEnabled, toggleAudio } = useAVToggle((err) => {
    console.error("[HMS] useAVToggle error:", err);
  });
  const localPeer = useHMSStore(selectLocalPeer);
  const publishPermissions = useHMSStore(selectIsAllowedToPublish);
  const localPeerId = useHMSStore(selectLocalPeerID);
  const isHandRaised = useHMSStore(selectHasPeerHandRaised(localPeerId));

  const { user } = useGlobalContext();
  const hmsActions = useHMSActions();
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTippingOpen, setIsTippingOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);

  const canUnmute = Boolean(publishPermissions?.audio && toggleAudio);
  const [cooldownEndTime, setCooldownEndTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const { requestToSpeak } = useSpeakerRequestEvent();

  useSpeakerRejectionEvent((msg) => {
    console.log("[HMS Event - Conference] Speaker request event received", {
      peer: msg.peer,
      timestamp: new Date().toISOString(),
    });
    handleRejectRequest({ peerId: msg.peer });
  });

  const handleRejectRequest = ({ peerId }: { peerId: string }) => {
    if (localPeer?.id === peerId) {
      toast.info(`Your speaker request was rejected.`, {
        autoClose: 3000,
        toastId: `speaker-reject-${peerId}-${Date.now()}`
      });
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCooldown = localStorage.getItem(`speakerCooldown_${localPeerId || user?.fid}`);
      if (storedCooldown) {
        const endTime = parseInt(storedCooldown);
        if (endTime > Date.now()) {
          setCooldownEndTime(endTime);
        } else {
          localStorage.removeItem(`speakerCooldown_${localPeerId || user?.fid}`);
        }
      }
    }
  }, [localPeerId, user?.fid]);

  useEffect(() => {
    if (cooldownEndTime > Date.now()) {
      const interval = setInterval(() => {
        const remaining = Math.ceil((cooldownEndTime - Date.now()) / 1000);
        if (remaining <= 0) {
          setCooldownEndTime(0);
          setCooldownRemaining(0);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(`speakerCooldown_${localPeerId || user?.fid}`);
          }
        } else {
          setCooldownRemaining(remaining);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [cooldownEndTime, localPeerId, user?.fid]);

  useEffect(() => {
    if (canUnmute && cooldownEndTime > 0) {
      setCooldownEndTime(0);
      setCooldownRemaining(0);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`speakerCooldown_${localPeerId || user?.fid}`);
      }
      toast.success("You can now speak!", { autoClose: 3000 });
    }
  }, [canUnmute, cooldownEndTime, localPeerId, user?.fid]);

  const { toggleRaiseHand } = useHandRaiseLogic({
    isHandRaised,
    localPeerId,
  });

  const { handleEmojiSelect, floatingEmojis, isDisabled } = useEmojiReactionLogic({ user });

  const soundboardLogic = useSoundboardLogic(user);

  const isListener = localPeer?.roleName?.toLowerCase() === 'listener';

  const handleRequestToSpeak = () => {
    const endTime = Date.now() + 90000;
    setCooldownEndTime(endTime);
    setCooldownRemaining(90);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`speakerCooldown_${localPeerId || user?.fid}`, endTime.toString());
    }
    
    requestToSpeak(localPeerId as string);
    
    toast.success("🎙️ Speaker request sent", { 
      autoClose: 3000
    });
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
          muted={isListener ? false : !isLocalAudioEnabled}
          setMuted={(muted) => {
            if (isListener && !canUnmute) {
              handleRequestToSpeak();
            } else if (muted && isLocalAudioEnabled && toggleAudio) {
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
          canUnmute={canUnmute}
          isListener={isListener}
          cooldownRemaining={cooldownRemaining}
          hmsActions={hmsActions}
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
