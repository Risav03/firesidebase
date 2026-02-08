import { useState, useEffect, useCallback } from "react";
import { useXMTP } from "@/contexts/XMTPContext";
import { Client, IdentifierKind } from "@xmtp/browser-sdk";
import type { Group } from "@xmtp/browser-sdk";

interface UseXMTPRoomGroupProps {
  roomId: string;
  roomName?: string;
  roomImageUrl?: string;
  isHost?: boolean;
}

interface UseXMTPRoomGroupReturn {
  group: Group | null;
  isLoading: boolean;
  isCreator: boolean;
  error: string | null;
  createGroup: () => Promise<void>;
  addMember: (walletAddress: string) => Promise<boolean>;
  addMembers: (walletAddresses: string[]) => Promise<number>;
  syncGroup: () => Promise<void>;
}

// Storage key prefix for room-to-group mappings
const ROOM_GROUP_STORAGE_KEY = "xmtp_room_group_";
const GROUP_OPERATION_TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Hook for managing XMTP group chats for rooms
 * 
 * Handles:
 * - Creating optimistic groups for hosts
 * - Discovering existing groups for participants
 * - Adding members to groups
 * - Persisting group mappings
 */
export function useXMTPRoomGroup({
  roomId,
  roomName,
  roomImageUrl,
  isHost = false,
}: UseXMTPRoomGroupProps): UseXMTPRoomGroupReturn {
  const { client, isInitialized } = useXMTP();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get the storage key for this room's group mapping
   */
  const getStorageKey = useCallback(() => {
    return `${ROOM_GROUP_STORAGE_KEY}${roomId}`;
  }, [roomId]);

  /**
   * Save group ID to localStorage for persistence
   */
  const saveGroupMapping = useCallback((groupId: string) => {
    try {
      localStorage.setItem(getStorageKey(), groupId);
    } catch (err) {
      console.error("Failed to save group mapping:", err);
    }
  }, [getStorageKey]);

  /**
   * Load group ID from localStorage
   */
  const loadGroupMapping = useCallback((): string | null => {
    try {
      return localStorage.getItem(getStorageKey());
    } catch (err) {
      console.error("Failed to load group mapping:", err);
      return null;
    }
  }, [getStorageKey]);

  /**
   * Find an existing group for this room
   */
  const findExistingGroup = useCallback(async (): Promise<Group | null> => {
    if (!client) return null;

    try {
      // First check if we have a stored group ID
      const storedGroupId = loadGroupMapping();
      
      // Get all groups with timeout
      const syncPromise = client.conversations.syncAll();
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Sync timeout')), GROUP_OPERATION_TIMEOUT_MS)
      );
      
      await Promise.race([syncPromise, timeoutPromise]).catch(() => {
        console.warn('Conversations sync timed out, continuing anyway');
      });
      
      const groups = await client.conversations.listGroups();

      if (storedGroupId) {
        // Try to find the stored group
        const storedGroup = groups.find((g) => g.id === storedGroupId);
        if (storedGroup) {
          return storedGroup;
        }
      }

      // Search for group by name/metadata
      // Using room name or room ID in group metadata to identify the right group
      for (const g of groups) {
        try {
          // Check if group name contains room ID (fallback identification)
          if (g.name?.includes(roomId)) {
            saveGroupMapping(g.id);
            return g;
          }
        } catch (err) {
          // Skip groups we can't access
          continue;
        }
      }

      return null;
    } catch (err) {
      console.error("Error finding existing group:", err);
      return null;
    }
  }, [client, roomId, loadGroupMapping, saveGroupMapping]);

  /**
   * Create a new XMTP group for this room (optimistic creation for instant availability)
   */
  const createGroup = useCallback(async () => {
    if (!client) {
      setError("XMTP client not initialized");
      return;
    }

    if (group) {
      console.log("Group already exists for this room");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Creating XMTP group for room:", roomId);
      
      // Create optimistic group with timeout
      const createPromise = client.conversations.createGroupOptimistic();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Group creation timeout')), GROUP_OPERATION_TIMEOUT_MS)
      );
      
      const newGroup = await Promise.race([createPromise, timeoutPromise]);

      setGroup(newGroup);
      setIsCreator(true);
      
      // Save the group mapping
      saveGroupMapping(newGroup.id);

      console.log("Created XMTP group for room:", roomId, "Group ID:", newGroup.id);
    } catch (err: any) {
      console.error("Failed to create XMTP group:", err);
      setError(err.message || "Failed to create group");
    } finally {
      setIsLoading(false);
    }
  }, [client, group, roomId, saveGroupMapping]);

  /**
   * Add a single member to the group by wallet address
   */
  const addMember = useCallback(async (walletAddress: string): Promise<boolean> => {
    if (!client || !group) {
      console.error("Cannot add member: client or group not ready");
      return false;
    }

    try {
      // Check if address can receive messages
      const canMessageMap = await Client.canMessage([{
        identifier: walletAddress,
        identifierKind: IdentifierKind.Ethereum,
      }]);

      console.log(`Can message ${walletAddress}:`, canMessageMap);

      if (!canMessageMap.get(walletAddress)) {
        console.warn(`Address ${walletAddress} cannot receive XMTP messages`);
        return false;
      }

      // Add member using address (browser SDK handles conversion)
      // @ts-ignore - Browser SDK may accept addresses directly
      await group.addMembers([walletAddress]);
      console.log(`Added member ${walletAddress} to group`);
      
      return true;
    } catch (err) {
      console.error(`Failed to add member ${walletAddress}:`, err);
      return false;
    }
  }, [client, group]);

  /**
   * Add multiple members to the group by wallet addresses
   * Returns the count of successfully added members
   */
  const addMembers = useCallback(async (walletAddresses: string[]): Promise<number> => {
    if (!client || !group) {
      console.error("Cannot add members: client or group not ready");
      return 0;
    }

    if (walletAddresses.length === 0) {
      return 0;
    }

    try {
      // Check which addresses can receive messages
      const identifiers = walletAddresses.map(addr => ({
        identifier: addr,
        identifierKind: IdentifierKind.Ethereum,
      }));
      
      const canMessageMap = await Client.canMessage(identifiers);
      
      // Filter for reachable addresses
      const validAddresses = walletAddresses.filter((addr) => canMessageMap.get(addr) === true);

      if (validAddresses.length === 0) {
        console.warn("No valid addresses to add");
        return 0;
      }

      // Add all members at once (browser SDK handles conversion)
      // @ts-ignore - Browser SDK may accept addresses directly
      await group.addMembers(validAddresses);
      console.log(`Added ${validAddresses.length} members to group`);
      
      return validAddresses.length;
    } catch (err) {
      console.error("Failed to add members:", err);
      return 0;
    }
  }, [client, group]);

  /**
   * Sync the group with the network
   * Useful after optimistic operations
   */
  const syncGroup = useCallback(async () => {
    if (!client || !group) {
      return;
    }

    try {
      await group.sync();
      console.log("Group synced successfully");
    } catch (err) {
      console.error("Failed to sync group:", err);
    }
  }, [client, group]);

  /**
   * Initialize: Create group for host or find existing group for participants
   */
  useEffect(() => {
    if (!client || !isInitialized || !roomId) {
      return;
    }

    const initialize = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("Initializing XMTP room group for:", roomId);
        
        // Try to find existing group first
        const existingGroup = await findExistingGroup();
        
        if (existingGroup) {
          setGroup(existingGroup);
          setIsCreator(false);
          console.log("Found existing XMTP group for room:", roomId);
        } else if (isHost) {
          // Host creates the group if it doesn't exist
          await createGroup();
        } else {
          // Participant waits for host to create group
          console.log("Waiting for host to create XMTP group...");
        }
      } catch (err) {
        console.error("Error initializing XMTP room group:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize group");
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [client, isInitialized, roomId, isHost]);

  return {
    group,
    isLoading,
    isCreator,
    error,
    createGroup,
    addMember,
    addMembers,
    syncGroup,
  };
}
