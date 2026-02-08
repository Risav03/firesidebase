"use client";

import { useEffect, useRef } from "react";
import { selectPeers, useHMSStore } from "@100mslive/react-sdk";
import { useXMTPRoomGroup } from "@/hooks/useXMTPRoomGroup";

interface ParticipantSyncProps {
  roomId: string;
  isHost: boolean;
}

/**
 * Component that synchronizes HMS room participants with XMTP group chat
 * 
 * Monitors HMS peer joins/leaves and automatically adds participants to the XMTP group.
 * Only active for room hosts.
 */
export function ParticipantSync({ roomId, isHost }: ParticipantSyncProps) {
  const allPeers = useHMSStore(selectPeers);
  const processedPeersRef = useRef<Set<string>>(new Set());

  const { group, addMember } = useXMTPRoomGroup({
    roomId,
    isHost,
  });

  useEffect(() => {
    // Only host should manage group membership
    if (!isHost || !group) {
      return;
    }

    // Process new peers
    const addNewPeers = async () => {
      for (const peer of allPeers) {
        // Skip if already processed
        if (processedPeersRef.current.has(peer.id)) {
          continue;
        }

        try {
          // Extract wallet address from peer metadata
          const metadata = peer.metadata;
          let walletAddress: string | null = null;

          if (metadata) {
            try {
              const parsedMetadata = JSON.parse(metadata);
              walletAddress = parsedMetadata.wallet || null;
            } catch (e) {
              console.warn("Failed to parse peer metadata:", e);
            }
          }

          if (walletAddress) {
            console.log(`Adding peer ${peer.name} (${peer.id}) to XMTP group`, walletAddress);
            
            // Add member to XMTP group
            const success = await addMember(walletAddress);
            
            if (success) {
              console.log(`Successfully added ${peer.name} to XMTP group`);
              processedPeersRef.current.add(peer.id);
            } else {
              console.warn(`Failed to add ${peer.name} to XMTP group - may not have XMTP identity`);
              // Still mark as processed to avoid retrying
              processedPeersRef.current.add(peer.id);
            }
          } else {
            console.warn(`Peer ${peer.name} (${peer.id}) has no wallet address in metadata`);
            processedPeersRef.current.add(peer.id);
          }
        } catch (error) {
          console.error(`Error adding peer ${peer.id} to XMTP group:`, error);
          // Mark as processed to prevent infinite retries
          processedPeersRef.current.add(peer.id);
        }
      }
    };

    addNewPeers();
  }, [allPeers, isHost, group, addMember]);

  // Cleanup: Remove peers from processed set when they leave
  useEffect(() => {
    const currentPeerIds = new Set(allPeers.map(p => p.id));
    
    // Remove peers that have left from the processed set
    processedPeersRef.current.forEach((peerId) => {
      if (!currentPeerIds.has(peerId)) {
        processedPeersRef.current.delete(peerId);
      }
    });
  }, [allPeers]);

  // This component doesn't render anything
  return null;
}
