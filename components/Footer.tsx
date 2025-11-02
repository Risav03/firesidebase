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
  selectPeers,
  HMSStore,
} from "@100mslive/react-sdk";
import { useSpeakerRequestEvent, useSpeakerRejectionEvent, useEmojiReactionEvent } from "@/utils/events";
// Ads UI removed as part of migration
import { FaMoneyBill } from "react-icons/fa";
import { TbShare3 } from "react-icons/tb";
import { sdk } from "@farcaster/miniapp-sdk";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { IoIosArrowDown } from "react-icons/io";
import { useGlobalContext } from "../utils/providers/globalContext";
import { MdCopyAll, MdOutlineIosShare } from "react-icons/md";
import TippingModal from "./TippingModal";
import { toast } from "react-toastify";
import Image from "next/image";

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
    toast.success("🎙️ Speaker request sent", { 
      autoClose: 3000
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
      toast.success("You can now speak!", { autoClose: 3000 });
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
            ? async () => {
                try {
                  console.group('[AUDIO DEBUG] Mute/Unmute Event');
                  console.log('Audio toggle initiated', {
                    currentState: isLocalAudioEnabled,
                    targetState: !isLocalAudioEnabled,
                    peerId: localPeer?.id,
                    peerName: localPeer?.name,
                    role: localRoleName,
                    timestamp: new Date().toISOString(),
                  });
                  
                  console.groupEnd();
                  
                  if (!isLocalAudioEnabled) {
                    // Only lower hand when unmuting
                    console.log("[HMS Action] Lowering hand before unmuting");
                    await hmsActions?.lowerLocalPeerHand?.();
                  }
                  
                  // Safely toggle audio with error handling
                  if (toggleAudio) {
                    toggleAudio();
                    
                    // Log after toggle to capture any state changes
                    setTimeout(() => {
                      console.log('[AUDIO DEBUG] After toggle - check console for peer updates');
                    }, 500);
                  }
                } catch (error) {
                  console.error("[HMS Action] Error toggling audio:", error);
                  // Attempt to recover by re-initializing audio state
                  toast.error("Failed to toggle microphone. Please try again.");
                }
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
    console.error("[HMS] useAVToggle error:", err);
  });
  const amIScreenSharing = useHMSStore(selectIsLocalScreenShared);
  const hmsActions = useHMSActions();
  const room = useHMSStore(selectRoom);
  const messages = useHMSStore(selectHMSMessages) as Array<any>;
  const localPeer = useHMSStore(selectLocalPeer);
  const notification = useHMSNotifications();
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

  // Log all HMS notifications for debugging
  useEffect(() => {
    if (notification) {
      console.log("[HMS Event]", {
        type: notification.type,
        timestamp: new Date().toISOString(),
        data: notification.data,
        localPeer: localPeer?.name,
        localPeerId: localPeer?.id,
        localRole: localPeer?.roleName,
        isLocalAudioEnabled,
      });
    }
  }, [notification, localPeer, isLocalAudioEnabled]);
  
  // Hand raise functionality
  const localPeerId = useHMSStore(selectLocalPeerID);
  const isHandRaised = useHMSStore(selectHasPeerHandRaised(localPeerId));
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
      console.error("[HMS Action] Error toggling hand raise:", error);
    }
  }, [hmsActions, isHandRaised, handRaiseDisabled, localPeerId]);

  const { sendEmoji } = useEmojiReactionEvent((msg: { emoji: string; sender: string }) => {
    console.log("[HMS Event] Emoji reaction received", {
      emoji: msg.emoji,
      sender: msg.sender,
      timestamp: new Date().toISOString(),
    });
    
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

  // Initialize emoji message filtering only once when component mounts
  useEffect(() => {
    hmsActions.ignoreMessageTypes(['EMOJI_REACTION']);
  }, [hmsActions]);

  var emojiTimeout: NodeJS.Timeout | null = null;

  // Simple direct emoji handling with reduced timeout
  const handleEmojiSelect = (emoji: { emoji: string }) => {
    if (emojiTimeout) return;

    console.log("[HMS Action] Sending emoji reaction", {
      emoji: emoji.emoji,
      sender: user?.pfp_url,
      timestamp: new Date().toISOString(),
    });

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
    zIndex: 1000
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

  // Ads UI removed as part of migration

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

      {/* Ads UI removed */}
    </div>
  );
}
// Ads modal removed as part of migration