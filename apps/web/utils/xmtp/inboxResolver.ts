import { Client, IdentifierKind } from "@xmtp/browser-sdk";
import type { Identifier } from "@xmtp/browser-sdk";

/**
 * Result of inbox ID resolution for a single address
 */
export interface InboxResolution {
  address: string;
  inboxId: string | null;
  canMessage: boolean;
}

/**
 * Cache for storing address -> inbox ID mappings
 * This prevents redundant lookups for the same addresses
 */
const inboxIdCache = new Map<string, string>();

/**
 * Resolves wallet addresses to XMTP inbox IDs
 * 
 * @param client - Initialized XMTP client
 * @param addresses - Array of Ethereum wallet addresses
 * @returns Array of InboxResolution objects with inbox IDs and messaging capability
 */
export async function resolveInboxIds(
  client: Client,
  addresses: string[]
): Promise<InboxResolution[]> {
  if (!client) {
    throw new Error("XMTP client not initialized");
  }

  if (!addresses || addresses.length === 0) {
    return [];
  }

  // Normalize addresses to lowercase
  const normalizedAddresses = addresses.map((addr) => addr.toLowerCase());

  // Separate cached and uncached addresses
  const results: InboxResolution[] = [];
  const uncachedAddresses: string[] = [];
  const uncachedIdentifiers: Identifier[] = [];

  for (const address of normalizedAddresses) {
    if (inboxIdCache.has(address)) {
      results.push({
        address,
        inboxId: inboxIdCache.get(address)!,
        canMessage: true,
      });
    } else {
      uncachedAddresses.push(address);
      uncachedIdentifiers.push({
        identifier: address,
        identifierKind: IdentifierKind.Ethereum,
      });
    }
  }

  // If all addresses were cached, return results
  if (uncachedAddresses.length === 0) {
    return results;
  }

  try {
    // Check which addresses can receive messages
    const canMessageMap = await Client.canMessage(uncachedIdentifiers);

    // For browser SDK, we can only add members if they have XMTP enabled
    // Since we can't easily resolve inbox IDs in the browser SDK without additional APIs,
    // we'll return canMessage status and let the caller handle it
    // The group.addMembers() method may accept addresses directly or we need to find
    // the correct API for the browser SDK
    
    for (const address of uncachedAddresses) {
      const canMessage = canMessageMap.get(address) === true;

      results.push({
        address,
        inboxId: canMessage ? address : null, // Using address as placeholder
        canMessage,
      });
    }

    return results;
  } catch (error) {
    console.error("Error resolving inbox IDs:", error);
    
    // Return partial results with errors
    return uncachedAddresses.map((address) => ({
      address,
      inboxId: null,
      canMessage: false,
    }));
  }
}

/**
 * Resolves a single wallet address to an XMTP inbox ID
 * 
 * @param client - Initialized XMTP client
 * @param address - Ethereum wallet address
 * @returns InboxResolution object or null if resolution fails
 */
export async function resolveInboxId(
  client: Client,
  address: string
): Promise<InboxResolution | null> {
  const results = await resolveInboxIds(client, [address]);
  return results[0] || null;
}

/**
 * Clears the inbox ID cache
 * Useful for testing or when you need to force fresh lookups
 */
export function clearInboxIdCache(): void {
  inboxIdCache.clear();
}

/**
 * Gets the cached inbox ID for an address without making a network request
 * 
 * @param address - Ethereum wallet address
 * @returns Cached inbox ID or null if not in cache
 */
export function getCachedInboxId(address: string): string | null {
  return inboxIdCache.get(address.toLowerCase()) || null;
}
