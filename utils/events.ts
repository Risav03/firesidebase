"use client";

import { useCallback, useEffect } from "react";
import { useRtmClient } from "@/utils/providers/rtm";

type RtmEnvelope<T = any> = {
  type: string;
  payload?: T;
  from?: string;
  ts?: number;
};

function useRtmEvent<T = any>(
  eventType: string,
  onEvent?: (payload: T) => void
) {
  const { channel } = useRtmClient();

  const send = useCallback(
    async (payload: T) => {
      if (!channel) return;
      const envelope: RtmEnvelope<T> = {
        type: eventType,
        payload,
        ts: Date.now(),
      };
      try {
        await channel.sendMessage({ text: JSON.stringify(envelope) });
      } catch (e) {
        console.error(`[RTM] Failed to send ${eventType}:`, e);
      }
    },
    [channel, eventType]
  );

  useEffect(() => {
    if (!channel || !onEvent) return;

    const handler = ({ text }: any) => {
      try {
        const data: RtmEnvelope<T> = JSON.parse(text);
        if (data?.type === eventType) {
          onEvent(data.payload as T);
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    channel.on("ChannelMessage", handler);
    return () => {
      try {
        channel.off("ChannelMessage", handler);
      } catch {}
    };
  }, [channel, eventType, onEvent]);

  return { send };
}

/**
 * Custom hook for handling speaker requests
 * @param onEvent Callback function called when a speaker request is received
 * @returns Object containing sendEvent function to send a speaker request
 */
export const useSpeakerRequestEvent = (
  onEvent?: (msg: { peer: string }) => void
) => {
  const { send } = useRtmEvent<{ peer: string }>("SPEAKER_REQUESTED", onEvent);
  const requestToSpeak = (peerId: string) => send({ peer: peerId });
  return { requestToSpeak, sendEvent: send };
};

/**
 * Custom hook for handling speaker rejections
 * @param onEvent Callback function called when a speaker rejection is received
 * @returns Object containing sendEvent function to reject a speaker request
 */
export const useSpeakerRejectionEvent = (
  onEvent?: (msg: { peer: string }) => void
) => {
  const { send } = useRtmEvent<{ peer: string }>("SPEAKER_REJECTED", onEvent);
  const rejectSpeakerRequest = (peerId: string) => send({ peer: peerId });
  return { rejectSpeakerRequest, sendEvent: send };
};

/**
 * Custom hook for handling room ended events
 * @param onEvent Callback function called when a room ended event is received
 * @returns Object containing sendEvent function to send a room ended event
 */
export const useRoomEndedEvent = (
  onEvent?: (msg: { message: string }) => void
) => {
  const { send } = useRtmEvent<{ message: string }>("ROOM_ENDED", onEvent);
  const endRoom = (message: string = "Room has been ended by the host.") => send({ message });
  return { endRoom, sendEvent: send };
};

/**
 * Custom hook for handling emoji reactions
 * @param onEvent Callback function called when an emoji reaction is received
 * @returns Object containing sendEvent function to send an emoji reaction
 */
export const useEmojiReactionEvent = (
  onEvent?: (msg: { emoji: string; sender: string; id?: number; position?: number; fontSize?: string }) => void
) => {
  const { send } = useRtmEvent<{ emoji: string; sender: string; id?: number; position?: number; fontSize?: string }>(
    "EMOJI_REACTION",
    onEvent
  );
  const sendEmoji = (emoji: string, sender: string) => send({ emoji, sender });
  return { sendEmoji, sendEvent: send };
};

/**
 * Custom hook for handling new sponsor events
 * @param onEvent Callback function called when a new sponsor event is received
 * @returns Object containing sendEvent function to broadcast a new sponsor notification
 */
export const useNewSponsorEvent = (
  onEvent?: (msg: { sponsorName: string }) => void
) => {
  const { send } = useRtmEvent<{ sponsorName: string }>("NEW_SPONSOR", onEvent);
  const notifyNewSponsor = (sponsorName: string) => send({ sponsorName });
  return { notifyNewSponsor, sendEvent: send };
};

/**
 * Custom hook for handling active sponsor events
 * @param onEvent Callback function called when an active sponsor event is received
 * @returns Object containing sendEvent function to broadcast an active sponsor notification
 */
export const useActiveSponsor = (
  onEvent?: (msg: { sponsorshipId?: string; roomId?: string }) => void
) => {
  const { send } = useRtmEvent<{ sponsorshipId?: string; roomId?: string }>("ACTIVE_SPONSOR", onEvent);
  const activateSponsor = (sponsorshipId?: string, roomId?: string) => send({ sponsorshipId, roomId });
  return { activateSponsor, sendEvent: send };
};

/**
 * Custom hook for handling sponsor status events
 * @param onEvent Callback function called when a sponsor status event is received
 * @returns Object containing sendEvent function to broadcast a sponsor status notification
 */
export const useSponsorStatusEvent = (
  onEvent?: (msg: { userId: string; status: string; sponsorshipId?: string }) => void
) => {
  const { send } = useRtmEvent<{ userId: string; status: string; sponsorshipId?: string }>(
    "SPONSOR_STATUS",
    onEvent
  );
  const notifySponsorStatus = (userId: string, status: string, sponsorshipId?: string) => {
    send({ userId, status, sponsorshipId });
  };
  return { notifySponsorStatus, sendEvent: send };
};