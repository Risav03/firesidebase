"use client";

import { useState, useEffect, useCallback } from "react";
import Chat from "./Chat";
import {
  AudioLevelIcon,
  MicOffIcon,
  MicOnIcon,
  ShareScreenIcon,
} from "@100mslive/react-icons";
import { HandRaiseIcon } from "@100mslive/react-icons";
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
  HMSNotificationTypes,
  useHMSNotifications,
  selectBroadcastMessages,
  selectLocalPeerID,
  selectHasPeerHandRaised,
  selectLocalPeer,
  HMSActions,
  HMSPeer,
} from "@100mslive/react-sdk";
import { useSpeakerRequestEvent, useSpeakerRejectionEvent, useEmojiReactionEvent } from "@/utils/events";
import { RiAdvertisementFill } from "react-icons/ri";
import { FaMoneyBill } from "react-icons/fa";
import { TbShare3 } from "react-icons/tb";
import { sdk } from "@farcaster/miniapp-sdk";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { IoIosArrowDown } from "react-icons/io";
import { useGlobalContext } from "../utils/providers/globalContext";
import { MdCopyAll, MdOutlineIosShare } from "react-icons/md";
import TippingModal from "./TippingModal";
import toast from "react-hot-toast";
import Image from "next/image";

// Dynamic import to avoid SSR issues
let plugin: any = null;

// FooterProps removed since chat state is now internal

// MicComponent for handling different mic states based on roles
interface MicComponentProps {
  isLocalAudioEnabled: boolean;
  toggleAudio: (() => void) | undefined;
  canUnmute: boolean;
  isRejoining: boolean;
  localRoleName: string | undefined;
  hmsActions: HMSActions;
  localPeer: HMSPeer | undefined;
  user: any;
}

const MicComponent: React.FC<MicComponentProps> = ({
  isLocalAudioEnabled,
  toggleAudio,
  canUnmute,
  isRejoining,
  localRoleName,
  hmsActions,
  localPeer,
  user
}) => {
  // State to track if a speaker request has been sent
  const [speakerRequested, setSpeakerRequested] = useState(false);
  
  // Check if speaker request was previously sent (persistent across renders)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRequest = localStorage.getItem(`speakerRequested_${localPeer?.id || user?.fid}`);
      if (storedRequest === 'true') {
        setSpeakerRequested(true);
      }
    }
  }, [localPeer?.id, user?.fid]);
  
  // Custom event to request speaker role
  const { requestToSpeak } = useSpeakerRequestEvent();

  useSpeakerRejectionEvent((msg) => {
    if (msg.peer === (localPeer?.id || user?.fid)) {
      setSpeakerRequested(false);
    }
  })

  
  const isListener = localRoleName === "listener";
  
  const handleRequestToSpeak = () => {
    setSpeakerRequested(true);
    
    // Store request state in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`speakerRequested_${localPeer?.id || user?.fid}`, 'true');
    }
    
    // Send event with peer information
    requestToSpeak(localPeer?.id as string);
    
    // Show feedback to the user that request was sent
    toast.success("Speaker request sent", { 
      icon: "🎙️",
      duration: 3000
    });
  };

  // Handle role update (useful when permissions change)
  useEffect(() => {
    if (canUnmute && speakerRequested) {
      // If the user can now unmute and had requested it, clear the request state
      setSpeakerRequested(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`speakerRequested_${localPeer?.id || user?.fid}`);
      }
      toast.success("You can now speak!", { duration: 3000 });
    }
  }, [canUnmute, speakerRequested, localPeer?.id, user?.fid]);

  // For listeners without unmute permission, show the request to speak button
  if (isListener && !canUnmute) {
    return (
      <div className="flex flex-col items-center">
        <button
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
            speakerRequested ? "bg-yellow-500 text-white shadow-lg" : "bg-fireside-orange text-white shadow-lg"
          }`}
          onClick={handleRequestToSpeak}
          disabled={speakerRequested || isRejoining}
          title={speakerRequested ? "Speaker request sent" : "Request to speak"}
        >
          {isRejoining ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500">
            {speakerRequested ? "Request sent" : "Request to speak"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <button
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 transform ${
          canUnmute && !isRejoining
            ? "hover:scale-105 active:scale-95"
            : "opacity-60 cursor-not-allowed"
        } ${
          isLocalAudioEnabled
            ? "bg-fireside-orange text-white shadow-lg"
            : "bg-red-500 text-white shadow-lg"
        }`}
        onClick={
          canUnmute && !isRejoining
            ? () => {
                if (!isLocalAudioEnabled) {
                  // Only lower hand when unmuting
                  hmsActions?.lowerLocalPeerHand?.();
                }
                toggleAudio?.();
              }
            : undefined
        }
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
      <div className="mt-3 ">
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
    </div>
  );
};

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
  const localPeer = useHMSStore(selectLocalPeer);
  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRejoining, setIsRejoining] = useState(false);
  // Unread message tracking
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    // Initialize from localStorage if available, otherwise use current time
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`lastReadTimestamp_${roomId}`);
      return stored ? parseInt(stored, 10) : Date.now();
    }
    return Date.now();
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const publishPermissions = useHMSStore(selectIsAllowedToPublish);
  const localRoleName = useHMSStore(selectLocalPeerRoleName);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  // Update floatingEmojis state type to include fontSize
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ emoji: string; sender: string; id: number; position: number; fontSize: string }>>([]);
  const { user } = useGlobalContext();
  const [isTippingModalOpen, setIsTippingModalOpen] = useState(false);
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [isAdsModalOpen, setIsAdsModalOpen] = useState(false);

  // Function to handle chat open/close and reset unread count
  const handleChatToggle = () => {
    const newChatState = !isChatOpen;
    setIsChatOpen(newChatState);
    
    // When opening chat, reset unread count and update last read timestamp
    if (newChatState) {
      const now = Date.now();
      setUnreadCount(0);
      setLastReadTimestamp(now);
      
      // Persist the timestamp to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(`lastReadTimestamp_${roomId}`, now.toString());
      }
    }
  };

  // Effect to track unread messages
  useEffect(() => {
    if (!isChatOpen && messages.length > 0) {
      // Filter out own messages and count only messages from others that arrived after last read
      const unreadMessages = messages.filter((message: any) => {
        if (!message.time) return false;
        
        // Check if message arrived after last read timestamp
        const isAfterLastRead = message.time.getTime() > lastReadTimestamp;
        
        // Check if message is not from current user
        const isNotOwnMessage = message.sender !== localPeer?.name && 
                               message.senderName !== localPeer?.name &&
                               message.sender !== user?.fid?.toString();
        
        return isAfterLastRead && isNotOwnMessage;
      });
      
      setUnreadCount(unreadMessages.length);
    }
  }, [messages, lastReadTimestamp, isChatOpen, localPeer?.name, user?.fid]);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  const canUnmute = Boolean(publishPermissions?.audio && toggleAudio);

  const hmsActions = useHMSActions();
  
  // Hand raise functionality
  const localPeerId = useHMSStore(selectLocalPeerID);
  const isHandRaised = useHMSStore(selectHasPeerHandRaised(localPeerId));
  const [handRaiseDisabled, setHandRaiseDisabled] = useState(false);
  const [handRaiseCountdown, setHandRaiseCountdown] = useState(10);
  
  const toggleRaiseHand = useCallback(async () => {
    try {
      if (isHandRaised) {
        await hmsActions.lowerLocalPeerHand();
      } else if(!isHandRaised && !handRaiseDisabled) {
        await hmsActions.raiseLocalPeerHand();
        // Set 10-second timeout on raising hand to prevent spamming
        setHandRaiseDisabled(true);
        setHandRaiseCountdown(10);
        
        // Start countdown
        const countdownInterval = setInterval(() => {
          setHandRaiseCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              setHandRaiseDisabled(false);
              return 10; // This reset doesn't take effect due to the clearInterval
            }
            return prev - 1;
          });
        }, 1000);
        
        // Clear interval after 10 seconds and explicitly reset states
        setTimeout(() => {
          clearInterval(countdownInterval);
          setHandRaiseDisabled(false);
          setHandRaiseCountdown(10);
        }, 10000);
      }
    } catch (error) {
      console.error("Error toggling hand raise:", error);
    }
  }, [hmsActions, isHandRaised, handRaiseDisabled]);

  const { sendEmoji } = useEmojiReactionEvent((msg: { emoji: string; sender: string }) => {
    const uniqueMsg = {
      ...msg,
      id: Date.now(),
      position: Math.random() * 30, // Random position within 150px from the right
      fontSize: (Math.random() * 0.5 + 1).toFixed(1) // Store a random font size between 1.2 and 1.7 rem
    };
    setFloatingEmojis((prev) => [...prev, uniqueMsg]);

    // Ensure emojis are cleared only after their dedicated timeout
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== uniqueMsg.id));
    }, 5000);
  });

        hmsActions.ignoreMessageTypes(['EMOJI_REACTION']);

        var emojiTimeout: NodeJS.Timeout | null = null;

  // Simple direct emoji handling with reduced timeout
  const handleEmojiSelect = (emoji: { emoji: string }) => {
    if (emojiTimeout) return;

    // Send emoji with a very short timeout to prevent rapid firing but still be responsive
    emojiTimeout = setTimeout(() => {
      sendEmoji(emoji.emoji, user?.pfp_url);
      emojiTimeout = null;
    }, 700); // Reduced from 1000ms to 700ms for better responsiveness
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

  // Listen for speaker requests (for hosts/co-hosts to handle)
  // useCustomEvent({
  //   type: "SPEAKER_REQUESTED",
  //   onEvent: (data: { peer: string }) => {
  //     if (isHost) {
  //       // Just use a generic name since we don't have easy access to peer names
  //       const peerName = "A participant";
        
  //       // Only notify hosts about speaker requests
  //       toast.custom(
  //         (t) => (
  //           <div className={`${
  //             t.visible ? 'animate-enter' : 'animate-leave'
  //           } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
  //             <div className="flex-1 w-0 p-4">
  //               <div className="flex items-start">
  //                 <div className="flex-shrink-0 pt-0.5">
  //                   <span role="img" aria-label="microphone" className="text-2xl">🎙️</span>
  //                 </div>
  //                 <div className="ml-3 flex-1">
  //                   <p className="text-sm font-medium text-gray-900">
  //                     Speaker Request
  //                   </p>
  //                   <p className="mt-1 text-sm text-gray-500">
  //                     {peerName} would like to speak
  //                   </p>
  //                 </div>
  //               </div>
  //             </div>
  //             <div className="flex border-l border-gray-200">
  //               <button
  //                 onClick={() => {
  //                   // Grant speaker role
  //                   if (data.peer) {
  //                     // Change role to speaker (allow publishing audio)
  //                     hmsActions.changeRole(data.peer, "speaker", true)
  //                       .then(() => {
  //                         toast.success(`Granted speaking permission to ${peerName}`);
  //                       })
  //                       .catch(err => {
  //                         console.error("Error changing role:", err);
  //                         toast.error("Failed to grant speaker permission");
  //                       });
  //                   }
  //                   toast.dismiss(t.id);
  //                 }}
  //                 className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
  //               >
  //                 Allow
  //               </button>
  //             </div>
  //           </div>
  //         ),
  //         { id: `speaker-request-${data.peer}`, duration: 10000 }
  //       );
  //     }
  //   }
  // });

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
        text: `Join this awesome room! https://farcaster.xyz/miniapps/jWGOUKHeE2fd/fireside-100ms/call/${roomId}`,
        embeds: [`https://farcaster.xyz/miniapps/jWGOUKHeE2fd/fireside-100ms/call/${roomId}`],
      });
    } catch (e) {
      console.error("Error composing cast:", e);
    }
  }

  const emojiPickerStyles = {
    backgroundColor: "#000000",
    "--epr-category-label-bg-color": "#000000",
    borderRadius: "0.5rem",
    width: "100%",
    height: "400px",
    margin: "auto",
  };

  // Add CSS for animations
  const styles = `
  @keyframes float {
    0% {
      transform: translateY(-15vh);
    }
    100% {
      transform: translateY(-90vh);
    }
  }

  @keyframes fade {
    0% {
      opacity: 0;
    }
    10% {
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

  const handleClickOutside = (event: MouseEvent) => {
    const emojiPickerElement = document.querySelector(".emoji-picker-container");
    if (emojiPickerElement && !emojiPickerElement.contains(event.target as Node)) {
      setIsEmojiPickerOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleTippingClick = () => {
    setIsTippingModalOpen((prev) => !prev);
  };

  const handleAdsClick = () => {
    setIsAdsModalOpen((prev) => !prev);
  };

  const isHost = localRoleName === "host" || localRoleName === "co-host";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-28 bg-black">
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

          {/* {room?.isNoiseCancellationEnabled && isPluginReady && plugin && (
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
          )} */}

          {/* Chat toggle button */}
        </div>

        <div className="flex items-center space-x-2 justify-end w-[70%]">
          <button
            onClick={handleChatToggle}
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
            {unreadCount > 0 && !isChatOpen && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center ">
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </button>

          {/* Hand raise button */}
          <button
            onClick={toggleRaiseHand}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform ${
              !handRaiseDisabled ? "hover:scale-105 active:scale-95" : " cursor-not-allowed"
            } ${
              isHandRaised
                ? "bg-fireside-orange text-white shadow-lg"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            disabled={handRaiseDisabled && !isHandRaised}
            title={handRaiseDisabled && !isHandRaised ? "Hand raise cooldown (10s)" : isHandRaised ? "Lower hand" : "Raise hand"}
          >
            {/* Show hand icon only when not in cooldown */}
            {!(handRaiseDisabled && !isHandRaised) && (
              <HandRaiseIcon className="w-5 h-5" />
            )}
            
            {/* Cooldown overlay with circular progress */}
            {handRaiseDisabled && !isHandRaised && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center">
                {/* Circular progress border */}
                <svg className="absolute inset-0 w-10 h-10 transform -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke="rgb(251, 146, 60)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${2 * Math.PI * 18 * (handRaiseCountdown / 10)}`}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                
                {/* Countdown number */}
                <span className="text-xs text-white font-semibold z-10">{handRaiseCountdown}</span>
              </div>
            )}
          </button>

          {/* Emoji reactions button */}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsEmojiPickerOpen((prev) => !prev);
            }}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:white/20 cursor-pointer select-none"
            title="Emoji reactions"
            role="button"
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
            onClick={handleTippingClick}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:bg-white/20"
            title="Send a tip"
          >
            <FaMoneyBill className="w-5 h-5" />
          </button>

          {/* Ads button - shown to hosts/co-hosts regardless of adsEnabled state */}
          {/* {(isHost || adsEnabled) && (
            <button
              onClick={handleAdsClick}
              className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 bg-white/10 text-white hover:bg-white/20"
              title="Advertisements"
            >
              <RiAdvertisementFill className="w-5 h-5" />
            </button>
          )} */}
        </div>

        {/* Chat component rendered here */}
        <Chat isOpen={isChatOpen} setIsChatOpen={handleChatToggle} roomId={roomId} />

        {/* Emoji Picker Drawer */}
          <div
            className={`absolute left-0 bottom-[8.5rem] z-50 w-full mx-auto transition-all flex items-center justify-center duration-200 emoji-picker-container ${
              isEmojiPickerOpen ? "" : "opacity-0 pointer-events-none"
            } rounded-t-xl`}
          >

              {isEmojiPickerOpen && (
                <EmojiPicker
                  reactionsDefaultOpen={true}
                  onReactionClick={handleEmojiSelect}
                  reactions={['1f525','1f602', '1f4af', '1f44e', '2764-fe0f', '1f44d', '1f622']}
                  theme={Theme.DARK}
                  onEmojiClick={handleEmojiSelect}
                  style={emojiPickerStyles}
                  autoFocusSearch={false}
                />
              )}
           


          </div>
          
        

        {/* Floating emoji rendering */}
        {floatingEmojis.map((floatingEmoji) => (
          <div
            key={floatingEmoji.id}
            className="absolute bottom-0 animate-float"
            style={{
              right: `${floatingEmoji.position}%`, // Use stored position
              transform: "translateX(-50%)",
              animation: "float 7s ease-out forwards",
            }}
          >
            <div style={{animation: "fade 3s ease-out forwards"}} className="flex flex-col pointer-events-none items-center relative justify-center rounded-full p-[0.1rem] aspect-square bg-black/50 border-2 border-black/50">
              <span
                style={{
                  fontSize: `${floatingEmoji.fontSize}rem`, // Use the stored font size for this specific emoji
                }}
              >
                {floatingEmoji.emoji}
              </span>
              <Image
              
                src={floatingEmoji.sender || "/default-pfp.png"}
                className="w-5 h-5 rounded-full border-2 border-black/50 absolute -bottom-[0.4rem] -right-[0.4rem]"
                alt={floatingEmoji.sender ? floatingEmoji.sender : "Default Avatar"}
                width={32}
                height={32}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tipping Modal */}
      {/* {isTippingModalOpen && ( */}
        <TippingModal
          isOpen={isTippingModalOpen}
          onClose={() => setIsTippingModalOpen(false)}
          roomId={roomId}
        />
      {/* )} */}

      {/* Ads Modal */}
      <AdsModal participants={room.peerCount || 0} isAdsModalOpen={isAdsModalOpen} setIsAdsModalOpen={setIsAdsModalOpen} isHost={isHost} adsEnabled={adsEnabled} setAdsEnabled={setAdsEnabled} />
    </div>
  );
}
const AdsModal = ({ participants, isAdsModalOpen, setIsAdsModalOpen, isHost, adsEnabled, setAdsEnabled}: {participants: number, isAdsModalOpen: boolean, setIsAdsModalOpen: (isOpen: boolean) => void, isHost: boolean, adsEnabled: boolean, setAdsEnabled: (isEnabled: boolean) => void}) => {
  
  const maxSeconds = 60 * 60 * 2;
  const [selectedTime, setSelectedTime] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Cost calculation formula
  const calculateCost = (seconds: number, participantCount: number) => {
    // Base cost per minute
    const baseRatePerMinute = 0.5; 
    
    // Convert seconds to minutes for calculation
    const minutes = seconds / 60;
    
    // Participant multiplier - increases cost based on audience size
    // Uses a logarithmic scale to avoid costs getting too high
    const participantMultiplier = Math.log10(participantCount + 1) + 1;
    
    // Time multiplier - gives discount for longer durations
    const timeMultiplier = Math.max(0.8, 1 - (minutes / 120) * 0.2);
    
    // Calculate final cost
    const cost = baseRatePerMinute * minutes * participantMultiplier * timeMultiplier;
    
    // Round to 2 decimal places and ensure minimum cost of $5
    return Math.max(0, Math.round(cost * 100) / 100);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} sec`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins} min ${secs} sec`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours} hr ${mins} min`;
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isAdsModalOpen) return null;

  if(!isHost) return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-5 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-lg font-bold text-center text-white mb-4">Sponsor Now</h2>
        <p className="text-sm text-green-500 text-center mb-4">Participants: {participants}</p>
        
        <div className="space-y-4">
          {selectedImage && (
            <div className="relative w-full h-[200px] bg-black/40 rounded-lg overflow-hidden mb-4">
              <img 
                src={selectedImage} 
                alt="Banner preview"
                className="w-full h-full object-contain"
              />
              <p className="absolute bottom-2 right-2 text-xs text-white bg-black/60 px-2 py-1 rounded">
                1080x200 display area
              </p>
            </div>
          )}

          <div>
            <label className="text-gray-300 text-sm block mb-2">Set time: {formatTime(selectedTime)}</label>
            <input
              type="range"
              min="0"
              max={maxSeconds}
              value={selectedTime}
              onChange={(e) => setSelectedTime(Number(e.target.value))}
              className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div
            className={`relative w-full min-h-[100px] border-2 border-dashed rounded-lg ${
              isDragging ? 'border-fireside-orange bg-black/60' : 'border-gray-600 bg-black/40'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center p-4">
              <p className="text-gray-300 text-sm text-center">
                Drop image here or click to upload
                <span className="block text-xs text-gray-500 mt-1">
                  Recommended size: 1080x200 - Larger images will be scaled to fit
                </span>
              </p>
            </div>
          </div>

          <div>
            <label className="text-gray-300 text-sm block mb-2">Advertisement Cost</label>
            <div className="w-full bg-black/40 text-white p-3 rounded-lg text-center">
              ${calculateCost(selectedTime, participants)}
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              Cost based on {participants} participants and {formatTime(selectedTime)}
            </p>
          </div>

          <button
            onClick={() => setIsAdsModalOpen(false)}
            className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded"
          >
            Appeal
          </button>
        </div>

        <button
          onClick={() => setIsAdsModalOpen(false)}
          className="mt-2 w-full bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded"
        >
          Close
        </button>
      </div>
    </div>
  )
  else return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-5 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-lg font-bold text-center text-white mb-4">Sponsorship Controls</h2>
        <div className="w-full h-[1px] bg-white/10 mx-auto mb-4"></div>
        {isHost ? (
          <div className="space-y-6">
            <div className="flex items-center justify-start gap-4">              
              <button 
                onClick={() => setAdsEnabled(!adsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${adsEnabled ? 'bg-fireside-orange' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${adsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-gray-300 text-base">Allow Sponsors</span>
            </div>
            <div className="space-y-4">
              {adsEnabled ? (
                <div className=" min-h-40 rounded-lg p-4 bg-black/40">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white">Request for 10mins</span>
                      <div className="space-x-2">
                        <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
                        <button className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">Reject</button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white">Request for 5min</span>
                      <div className="space-x-2">
                        <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
                        <button className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">Reject</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-white h-40 flex items-center justify-center bg-black/40 rounded-lg">Adds not enabled</p>
              )
              }
            </div>
          </div>
        ) : (
          <p className="text-white">Only hosts can manage sponsorship settings</p>
        )}
        <button
          onClick={() => setIsAdsModalOpen(false)}
          className="mt-6 w-full bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded hover:bg-opacity-80"
        >
          Close
        </button>
      </div>
    </div>
  )
};