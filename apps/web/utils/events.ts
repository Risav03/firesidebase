import { useCustomEvent } from "@100mslive/react-sdk";

/**
 * Custom hook for handling speaker requests
 * @param onEvent Callback function called when a speaker request is received
 * @returns Object containing sendEvent function to send a speaker request
 */
export const useSpeakerRequestEvent = (
  onEvent?: (msg: { peer: string, peerId:string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "SPEAKER_REQUESTED",
    onEvent: onEvent || ((msg: { peer: string }) => {}),
  });

  /**
   * Send a speaker request
   * @param peerId ID of the peer requesting to be a speaker
   */
  const requestToSpeak = (fid: string, peerId: string) => {
    sendEvent({ peer: fid, peerId: peerId });
  };

  return { requestToSpeak, sendEvent };
};

/**
 * Custom hook for handling speaker rejections
 * @param onEvent Callback function called when a speaker rejection is received
 * @returns Object containing sendEvent function to reject a speaker request
 */
export const useSpeakerRejectionEvent = (
  onEvent?: (msg: { peer: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "SPEAKER_REJECTED",
    onEvent: onEvent || ((msg: { peer: string }) => {}),
  });

  /**
   * Send a speaker rejection
   * @param peerId ID of the peer being rejected
   */
  const rejectSpeakerRequest = (peerId: string) => {
    sendEvent({ peer: peerId });
  };

  return { rejectSpeakerRequest, sendEvent };
};

/**
 * Custom hook for handling room ended events
 * @param onEvent Callback function called when a room ended event is received
 * @returns Object containing sendEvent function to send a room ended event
 */
export const useRoomEndedEvent = (
  onEvent?: (msg: { message: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "ROOM_ENDED",
    onEvent: onEvent || ((msg: { message: string }) => {}),
  });

  /**
   * Send a room ended event
   * @param message Optional message to include with the event
   */
  const endRoom = (message: string = "Room has been ended by the host?.") => {
    sendEvent({ message });
  };

  return { endRoom, sendEvent };
};

/**
 * Custom hook for handling emoji reactions
 * @param onEvent Callback function called when an emoji reaction is received
 * @returns Object containing sendEvent function to send an emoji reaction
 */
export const useEmojiReactionEvent = (
  onEvent?: (msg: { emoji: string; sender: string; id?: number; position?: number; fontSize?: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "EMOJI_REACTION",
    onEvent: onEvent || ((msg: { emoji: string; sender: string }) => {}),
  });

  /**
   * Send an emoji reaction
   * @param emoji The emoji to send
   * @param sender The sender's identifier (usually profile URL)
   */
  const sendEmoji = (emoji: string, sender: string) => {
    sendEvent({ emoji, sender });
  };

  return { sendEmoji, sendEvent };
};

/**
 * Custom hook for handling new sponsor events
 * @param onEvent Callback function called when a new sponsor event is received
 * @returns Object containing sendEvent function to broadcast a new sponsor notification
 */
export const useNewSponsorEvent = (
  onEvent?: (msg: { sponsorName: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "NEW_SPONSOR",
    onEvent: onEvent || ((msg: { sponsorName: string }) => {}),
  });

  /**
   * Broadcast a new sponsor event to all room participants
   * @param sponsorName The name of the sponsor
   */
  const notifyNewSponsor = (sponsorName: string) => {
    sendEvent({ sponsorName });
  };

  return { notifyNewSponsor, sendEvent };
};

/**
 * Custom hook for handling active sponsor events
 * @param onEvent Callback function called when an active sponsor event is received
 * @returns Object containing sendEvent function to broadcast an active sponsor notification
 */
export const useActiveSponsor = (
  onEvent?: (msg: { sponsorshipId?: string; roomId?: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "ACTIVE_SPONSOR",
    onEvent: onEvent || (() => {}),
  });

  /**
   * Broadcast an active sponsor event to all room participants
   * @param sponsorshipId The ID of the sponsorship (optional)
   * @param roomId The ID of the room (optional)
   */
  const activateSponsor = (sponsorshipId?: string, roomId?: string) => {
    sendEvent({ sponsorshipId, roomId });
  };

  return { activateSponsor, sendEvent };
};

/**
 * Custom hook for handling sponsor status events
 * @param onEvent Callback function called when a sponsor status event is received
 * @returns Object containing sendEvent function to broadcast a sponsor status notification
 */
export const useSponsorStatusEvent = (
  onEvent?: (msg: { userId: string; status: string; sponsorshipId?: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "SPONSOR_STATUS",
    onEvent: onEvent || ((msg: { userId: string; status: string }) => {}),
  });

  /**
   * Broadcast a sponsor status event to all room participants
   * @param userId The user ID of the sponsor
   * @param status The status of the sponsorship (e.g., "approved", "rejected", "pending")
   * @param sponsorshipId The ID of the sponsorship (optional)
   */
  const notifySponsorStatus = (userId: string, status: string, sponsorshipId?: string) => {
    sendEvent({ userId, status, sponsorshipId });
  };

  return { notifySponsorStatus, sendEvent };
};

/**
 * Custom hook for handling ads control events
 * @param onEvent Callback function called when ads control event is received
 * @returns Object containing sendEvent function to broadcast ads control notifications
 */
export const useAdsControlEvent = (
  onEvent?: (msg: { action: 'start' | 'stop'; roomId: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "ADS_CONTROL",
    onEvent: onEvent || ((msg: { action: 'start' | 'stop'; roomId: string }) => {}),
  });

  /**
   * Broadcast an ads control event to all room participants
   * @param action The action performed ('start' or 'stop')
   * @param roomId The room ID where the action occurred
   */
  const notifyAdsControl = (action: 'start' | 'stop', roomId: string) => {
    sendEvent({ action, roomId });
  };

  return { notifyAdsControl, sendEvent };
};

/**
 * Tip event message interface
 */
export interface TipEventMessage {
  roomId: string;
  tipper: {
    username: string;
    pfp_url: string;
  };
  recipients: Array<{
    username?: string;
    pfp_url?: string;
    role?: string;
    id?: string;
  }>;
  amount: {
    usd: number;
    currency: string;
    native: number;
  };
  timestamp: string;
}

/**
 * Custom hook for handling tip notification events
 * @param onEvent Callback function called when a tip is received
 * @returns Object containing sendEvent function to notify about tips
 */
export const useTipEvent = (
  onEvent?: (msg: TipEventMessage) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "TIP_RECEIVED",
    onEvent: onEvent || ((msg: TipEventMessage) => {}),
  });

  /**
   * Send a tip notification to all participants
   * @param tipData Complete tip information including tipper, recipients, amounts
   */
  const sendTipNotification = (tipData: TipEventMessage) => {
    sendEvent(tipData);
  };

  return { sendTipNotification, sendEvent };
};

/**
 * Sound played event message interface
 */
export interface SoundPlayedMessage {
  soundId: string;
  soundName: string;
  soundEmoji: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: number;
}

/**
 * Custom hook for handling soundboard sound played events
 * This is used to sync visual feedback across all peers when a sound is played
 * @param onEvent Callback function called when a sound is played
 * @returns Object containing sendEvent function to notify about sound playback
 */
export const useSoundPlayedEvent = (
  onEvent?: (msg: SoundPlayedMessage) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "SOUND_PLAYED",
    onEvent: onEvent || ((msg: SoundPlayedMessage) => {}),
  });

  /**
   * Notify all peers that a sound was played
   * @param soundId The ID of the sound played
   * @param soundName The display name of the sound
   * @param soundEmoji The emoji representing the sound
   * @param senderName The name of the person who played the sound
   * @param senderAvatar Optional avatar URL of the sender
   */
  const notifySoundPlayed = (
    soundId: string,
    soundName: string,
    soundEmoji: string,
    senderName: string,
    senderAvatar?: string
  ) => {
    sendEvent({
      soundId,
      soundName,
      soundEmoji,
      senderName,
      senderAvatar,
      timestamp: Date.now(),
    });
  };

  return { notifySoundPlayed, sendEvent };
};

/**
 * Custom hook for handling soundboard stop events
 * This is used when a host stops a sound that's currently playing
 * @param onEvent Callback function called when a sound is stopped
 * @returns Object containing sendEvent function to notify about sound stop
 */
export const useSoundStoppedEvent = (
  onEvent?: (msg: { stoppedBy: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "SOUND_STOPPED",
    onEvent: onEvent || ((msg: { stoppedBy: string }) => {}),
  });

  /**
   * Notify all peers that a sound was stopped
   * @param stoppedBy The name of the person who stopped the sound
   */
  const notifySoundStopped = (stoppedBy: string) => {
    sendEvent({ stoppedBy });
  };

  return { notifySoundStopped, sendEvent };
};