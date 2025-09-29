import { useCustomEvent } from "@100mslive/react-sdk";

/**
 * Custom hook for handling speaker requests
 * @param onEvent Callback function called when a speaker request is received
 * @returns Object containing sendEvent function to send a speaker request
 */
export const useSpeakerRequestEvent = (
  onEvent?: (msg: { peer: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "SPEAKER_REQUESTED",
    onEvent: onEvent || ((msg: { peer: string }) => {}),
  });

  /**
   * Send a speaker request
   * @param peerId ID of the peer requesting to be a speaker
   */
  const requestToSpeak = (peerId: string) => {
    sendEvent({ peer: peerId });
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
  const endRoom = (message: string = "Room has been ended by the host.") => {
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
   * @param sponsorId The ID of the sponsor user
   * @param sponsorshipId The ID of the sponsorship
   */
  const notifyNewSponsor = (sponsorName: string) => {
    sendEvent({ sponsorName });
  };

  return { notifyNewSponsor, sendEvent };
};

/**
 * Custom hook for handling sponsor approval events
 * @param onEvent Callback function called when a sponsor is approved
 * @returns Object containing sendEvent function to broadcast a sponsor approval notification
 */
export const useSponsorStatusEvent = (
  onEvent?: (msg: { sponsorId: string; userId: string; status: string }) => void
) => {
  const { sendEvent } = useCustomEvent({
    type: "SPONSOR_STATUS",
    onEvent: onEvent || ((msg: { sponsorId: string; userId: string; status: string }) => {}),
  });

  /**
   * Broadcast a sponsor approved event to all room participants
   * @param sponsorId The ID of the sponsorship
   * @param sponsorName The name of the sponsor
   * @param userId The user ID of the sponsor
   */
  const notifySponsorStatus = (sponsorId: string, userId: string, status: string) => {
    sendEvent({ sponsorId, userId, status });
  };

  return { notifySponsorStatus, sendEvent };
};