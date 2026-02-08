import { useState, useEffect, useCallback, useRef } from "react";
import type { Group, DecodedMessage } from "@xmtp/browser-sdk";

export interface XMTPMessageWithMetadata extends DecodedMessage {
  // Additional metadata for UI display
  senderAddress?: string;
  senderUsername?: string;
  senderDisplayName?: string;
  senderPfp?: string;
}

interface UseXMTPMessagesProps {
  group: Group | null;
  participantMetadata?: Map<string, {
    address: string;
    username: string;
    displayName: string;
    pfp_url: string;
  }>;
}

interface UseXMTPMessagesReturn {
  messages: XMTPMessageWithMetadata[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<boolean>;
  loadMoreMessages: () => Promise<void>;
  hasMore: boolean;
}

const MESSAGES_PAGE_SIZE = 50;
const LOAD_TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Hook for managing XMTP message streaming and sending for a group
 * 
 * Handles:
 * - Loading historical messages
 * - Streaming real-time messages
 * - Sending text messages
 * - Enriching messages with participant metadata
 */
export function useXMTPMessages({
  group,
  participantMetadata,
}: UseXMTPMessagesProps): UseXMTPMessagesReturn {
  const [messages, setMessages] = useState<XMTPMessageWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [oldestMessageNs, setOldestMessageNs] = useState<bigint | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const streamRef = useRef<any>(null);
  const isStreamingRef = useRef(false);

  /**
   * Enrich a message with participant metadata for UI display
   */
  const enrichMessage = useCallback((message: DecodedMessage): XMTPMessageWithMetadata => {
    // Try to find participant metadata by inbox ID
    const metadata = participantMetadata ? 
      Array.from(participantMetadata.values()).find((p) => {
        // This requires resolving inbox IDs to addresses - 
        // for now we'll use the message data as-is and enrich in the UI layer
        return false;
      }) : null;

    return {
      ...message,
      senderAddress: metadata?.address,
      senderUsername: metadata?.username,
      senderDisplayName: metadata?.displayName,
      senderPfp: metadata?.pfp_url,
    };
  }, [participantMetadata]);

  /**
   * Load initial historical messages
   */
  const loadInitialMessages = useCallback(async () => {
    if (!group) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('Loading initial messages...');
      
      // Sync group to get latest messages with timeout
      const syncPromise = group.sync();
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Sync timeout')), LOAD_TIMEOUT_MS)
      );
      
      await Promise.race([syncPromise, timeoutPromise]).catch(() => {
        console.warn('Group sync timed out, continuing anyway');
      });

      // Get recent messages
      const fetchedMessages = await group.messages({ 
        limit: BigInt(MESSAGES_PAGE_SIZE) 
      });

      if (fetchedMessages.length < MESSAGES_PAGE_SIZE) {
        setHasMore(false);
      }

      if (fetchedMessages.length > 0) {
        const oldestMsg = fetchedMessages[fetchedMessages.length - 1];
        if (oldestMsg.sentAtNs) {
          setOldestMessageNs(oldestMsg.sentAtNs);
        }
      }

      // Enrich and set messages (newest first)
      const enrichedMessages = fetchedMessages
        .map(enrichMessage)
        .reverse(); // Reverse to show newest at bottom

      setMessages(enrichedMessages);
      setIsInitialized(true);
      console.log(`Loaded ${enrichedMessages.length} historical messages`);
    } catch (err: any) {
      console.error("Failed to load messages:", err);
      setError(err.message || "Failed to load messages");
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }, [group, enrichMessage]);

  /**
   * Load more (older) messages for pagination
   */
  const loadMoreMessages = useCallback(async () => {
    if (!group || !hasMore || isLoading || !oldestMessageNs) return;

    setIsLoading(true);

    try {
      // Get older messages before the oldest we have
      const fetchedMessages = await group.messages({
        limit: BigInt(MESSAGES_PAGE_SIZE),
        sentBeforeNs: oldestMessageNs,
      });

      if (fetchedMessages.length < MESSAGES_PAGE_SIZE) {
        setHasMore(false);
      }

      if (fetchedMessages.length > 0) {
        const oldestMsg = fetchedMessages[fetchedMessages.length - 1];
        if (oldestMsg.sentAtNs) {
          setOldestMessageNs(oldestMsg.sentAtNs);
        }

        // Enrich and prepend older messages
        const enrichedMessages = fetchedMessages.map(enrichMessage).reverse();
        setMessages((prev) => [...enrichedMessages, ...prev]);
        console.log(`Loaded ${enrichedMessages.length} more messages`);
      }
    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [group, hasMore, isLoading, oldestMessageNs, enrichMessage]);

  /**
   * Start streaming new messages
   */
  const startMessageStream = useCallback(async () => {
    if (!group || isStreamingRef.current) return;

    isStreamingRef.current = true;

    try {
      console.log("Starting message stream for group");

      // Stream messages for this group
      streamRef.current = await group.stream({
        onValue: (message: DecodedMessage) => {
          console.log("Received new message:", message);
          
          // Add new message to the list
          setMessages((prev) => {
            // Check if message already exists (deduplication)
            const exists = prev.some((m) => m.id === message.id);
            if (exists) return prev;

            // Add to end (newest messages at bottom)
            return [...prev, enrichMessage(message)];
          });
        },
        onError: (error: Error) => {
          console.error("Message stream error:", error);
          setError(error.message);
        },
      });
    } catch (err: any) {
      console.error("Failed to start message stream:", err);
      setError(err.message || "Failed to start message stream");
      isStreamingRef.current = false;
    }
  }, [group, enrichMessage]);

  /**
   * Stop streaming messages
   */
  const stopMessageStream = useCallback(() => {
    if (streamRef.current) {
      // The stream will be garbage collected when we leave the component
      streamRef.current = null;
      isStreamingRef.current = false;
      console.log("Stopped message stream");
    }
  }, []);

  /**
   * Send a text message to the group
   */
  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!group) {
      console.error("Cannot send message: group not ready");
      return false;
    }

    if (!text.trim()) {
      return false;
    }

    try {
      // Send message
      await group.sendText(text);
      console.log("Message sent successfully");
      return true;
    } catch (err: any) {
      console.error("Failed to send message:", err);
      setError(err.message || "Failed to send message");
      return false;
    }
  }, [group]);

  /**
   * Initialize: Load messages and start streaming when group is ready
   */
  useEffect(() => {
    if (!group) {
      // Reset state when no group
      setMessages([]);
      setError(null);
      setHasMore(true);
      setOldestMessageNs(null);
      setIsInitialized(false);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      if (isMounted) {
        await loadInitialMessages();
        await startMessageStream();
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      stopMessageStream();
    };
  }, [group]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    loadMoreMessages,
    hasMore,
  };
}
