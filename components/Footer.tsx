"use client";

import { useState, useEffect, useCallback } from "react";
import Chat from "./Chat";
import {
  AudioLevelIcon,
  MicOffIcon,
  MicOnIcon,
  ShareScreenIcon,
} from "@100mslive/react-icons";
import {
  selectIsLocalAudioPluginPresent,
  selectIsLocalScreenShared,
  selectRoom,
  selectIsAllowedToPublish,
  selectLocalPeerRoleName,
  selectHMSMessages,
  useAVToggle,
  useHMSActions,
  useHMSStore,
  useCustomEvent,
  HMSNotificationTypes,
  useHMSNotifications,
  selectBroadcastMessages,
} from "@100mslive/react-sdk";
import { FaGratipay } from "react-icons/fa";
import { TbShare3 } from "react-icons/tb";
import { sdk } from "@farcaster/miniapp-sdk";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { IoIosArrowDown } from "react-icons/io";
import { useGlobalContext } from "../utils/providers/globalContext";

// Dynamic import to avoid SSR issues
let plugin: any = null;

// FooterProps removed since chat state is now internal

export default function Footer({ roomId }: { roomId: string }) {
  const { isLocalAudioEnabled, toggleAudio } = useAVToggle((err) => {
    console.error("useAVToggle error:", err);
  });
  const amIScreenSharing = useHMSStore(selectIsLocalScreenShared);
  const actions = useHMSActions();
  const room = useHMSStore(selectRoom);
  const [isPluginActive, setIsPluginActive] = useState(false);
  const [isPluginReady, setIsPluginReady] = useState(false);
  const messages = useHMSStore(selectHMSMessages) as Array<any>;
  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRejoining, setIsRejoining] = useState(false);
  const publishPermissions = useHMSStore(selectIsAllowedToPublish);
  const localRoleName = useHMSStore(selectLocalPeerRoleName);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ emoji: string; sender: string; id: number; position: number }>>([]);
  const { user } = useGlobalContext();

  const canUnmute = Boolean(publishPermissions?.audio && toggleAudio);

  const { sendEvent } = useCustomEvent({
    type: "EMOJI_REACTION",
    onEvent: (msg: { emoji: string; sender: string }) => {
      const uniqueMsg = { ...msg, id: Date.now(), position: Math.random() * 100 }; // Add unique identifier and position
      setFloatingEmojis((prev) => [...prev, uniqueMsg]);

      // Ensure emojis are cleared only after their dedicated timeout
      setTimeout(() => {
        setFloatingEmojis((prev) => prev.filter((e) => e.id !== uniqueMsg.id));
      }, 5000);
    },
  });

  const handleEmojiSelect = (emoji: any) => {
    const newEmoji = { emoji: emoji.emoji, sender: user?.username };
    sendEvent(newEmoji);
    setIsEmojiPickerOpen(false);
  };

  // Listen for role change events to show re-joining state
  useEffect(() => {
    const handleRoleChange = (event: CustomEvent) => {
      if (event.detail?.type === "role_change_start") {
        setIsRejoining(true);
      } else if (event.detail?.type === "role_change_complete") {
        setIsRejoining(false);
      }
    };

    window.addEventListener(
      "role_change_event",
      handleRoleChange as EventListener
    );
    return () => {
      window.removeEventListener(
        "role_change_event",
        handleRoleChange as EventListener
      );
    };
  }, []);

  useEffect(() => {
    // Helpful for debugging role/permission changes after promotions/demotions
    console.log("[100ms] Local role:", localRoleName);
    console.log("[100ms] Allowed to publish:", publishPermissions);
    console.log("[100ms] canUnmute:", canUnmute);
    console.log("[100ms] toggleAudio function exists:", !!toggleAudio);
    console.log("[100ms] Component re-rendered due to permission change");
  }, [localRoleName, publishPermissions, canUnmute, toggleAudio]);

  // Initialize plugin only on client side with dynamic import
  useEffect(() => {
    if (typeof window !== "undefined" && !plugin) {
      import("@100mslive/hms-noise-cancellation")
        .then(({ HMSKrispPlugin }) => {
          plugin = new HMSKrispPlugin();
          setIsPluginReady(true);
        })
        .catch((error) => {
          console.error("Failed to load noise cancellation plugin:", error);
        });
    }
  }, []);

  const isAudioPluginAdded = useHMSStore(
    selectIsLocalAudioPluginPresent(plugin?.getName() || "")
  );

  async function composeCast() {
    try {
      await sdk.actions.composeCast({
        text: `Join this awesome room! ${process.env.NEXT_PUBLIC_URL}/call/${roomId}`,
        embeds: [`${process.env.NEXT_PUBLIC_URL}/call/${roomId}`],
      });
    } catch (e) {
      console.error("Error composing cast:", e);
    }
  }

  const emojiPickerStyles = {
    "--epr-bg-color": "oklch(13% 0.028 261.692)",
    "--epr-category-label-bg-color": "oklch(13% 0.028 261.692)",
    "--epr-input-bg-color": "oklch(13% 0.028 261.692)",
    borderRadius: "0.5rem",
    border: "0px",
  };

  // Add CSS for animations
  const styles = `
  @keyframes float {
    0% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(-200vh);
    }
  }

  @keyframes fade {
    0% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  `;

  // Inject styles into the document
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-4 flex">
        <div className="flex flex-col items-start justify-center w-[30%]">
          <button
            className={`w-14 h-14 translate-x-[0.6rem] rounded-full flex items-center justify-center transition-all duration-200 transform ${
              canUnmute && !isRejoining
                ? "hover:scale-105 active:scale-95"
                : "opacity-60 cursor-not-allowed"
            } ${
              isLocalAudioEnabled
                ? "bg-fireside-orange text-white shadow-lg"
                : "bg-red-500 text-white shadow-lg"
            }`}
            onClick={canUnmute && !isRejoining ? toggleAudio : undefined}
            disabled={!canUnmute || isRejoining}
            title={
              isRejoining
                ? "Re-joining with new role..."
                : canUnmute
                ? isLocalAudioEnabled
                  ? "Mute"
                  : "Unmute"
                : `No permission to publish audio${
                    localRoleName ? ` (${localRoleName})` : ""
                  }`
            }
          >
            {isRejoining ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isLocalAudioEnabled ? (
              <MicOnIcon className="w-6 h-6" />
            ) : (
              <MicOffIcon className="w-6 h-6" />
            )}
          </button>
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500">
              {isRejoining
                ? "Re-joining with new role..."
                : canUnmute
                ? isLocalAudioEnabled
                  ? "Tap to mute"
                  : "Tap to unmute"
                : "Role cannot unmute"}
            </p>
          </div>

          {/* <button
            title="Screen share"
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
              amIScreenSharing 
                ? 'bg-fireside-blue text-white shadow-lg' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => actions.setScreenShareEnabled(!amIScreenSharing)}
          >
            <ShareScreenIcon className="w-6 h-6" />
          </button> */}

          {room?.isNoiseCancellationEnabled && isPluginReady && plugin && (
            <button
              title="Noise cancellation"
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                isPluginActive
                  ? "bg-fireside-purple text-white shadow-lg"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              onClick={async () => {
                if (!plugin) return;
                if (isAudioPluginAdded) {
                  plugin.toggle();
                  setIsPluginActive((prev) => !prev);
                } else {
                  await actions.addPluginToAudioTrack(plugin);
                  setIsPluginActive(true);
                }
              }}
            >
              <AudioLevelIcon className="w-6 h-6" />
            </button>
          )}

          {/* Chat toggle button */}
        </div>

        <div className="flex items-center space-x-2 justify-end w-[70%]">
          <button
            onClick={() => setIsChatOpen((prev) => !prev)}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
              isChatOpen
                ? "bg-fireside-orange text-white shadow-lg"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title="Toggle chat"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {messages.length > 0 && !isChatOpen && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {messages.length > 9 ? "9+" : messages.length}
              </div>
            )}
          </button>

          {/* Emoji Picker Drawer */}

          <div
            className={`fixed bottom-0 -left-2 z-50 w-screen mx-auto ${
              isEmojiPickerOpen ? "" : "translate-y-full"
            } bg-gray-950 rounded-t-xl pt-4 transition-all duration-200`}
          >
            <div className="w-full flex flex-col gap-2 items-center justify-center">
              <button
                onClick={() => setIsEmojiPickerOpen(false)}
                className="w-[30%] bg-white/10 text-white py-0 rounded-full "
              >
                <IoIosArrowDown className="mx-auto" />
              </button>
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={handleEmojiSelect}
                style={emojiPickerStyles}
              />
            </div>
          </div>

          {/* Emoji reactions button */}
          <button
            onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:white/20"
            title="Emoji reactions"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 20.5c4.142 0 7.5-3.358 7.5-7.5S16.142 5.5 12 5.5 4.5 8.858 4.5 12s3.358 7.5 7.5 7.5z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 11h.01M15 11h.01M8 15h8"
              />
            </svg>
          </button>

          {/* Tipping button */}
          <button
            onClick={() => console.log("Tipping clicked")}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:bg-white/20"
            title="Send a tip"
          >
            <FaGratipay className="w-5 h-5" />
          </button>
          <button
            onClick={() => composeCast()}
            className="text-white pl-4"
            title="Share"
          >
            <TbShare3 className="w-5 h-5" />
          </button>
        </div>

        {/* Chat component rendered here */}
        <Chat isOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />

        {/* Floating emoji rendering */}
        {floatingEmojis.map((floatingEmoji) => (
          <div
            key={floatingEmoji.id}
            className="absolute bottom-0 animate-float"
            style={{
              left: `${floatingEmoji.position}%`, // Use stored position
              transform: "translateX(-50%)",
              animation: "float 5s ease-out forwards",
            }}
          >
            <div className="flex flex-col items-center justify-center">
              <span
                style={{
                  fontSize: "1.5rem",
                  opacity: 1,
                  animation: "fade 5s ease-out forwards",
                }}
              >
                {floatingEmoji.emoji}
              </span>
              <p
                style={{
                  opacity: 1,
                  animation: "fade 5s ease-out forwards",
                }}
                className="text-xs text-center text-white"
              >
                {floatingEmoji.sender}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
