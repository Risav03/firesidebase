# XMTP Chat Integration Summary

## Overview
Successfully replaced the 100ms + Redis hybrid chat system with XMTP decentralized group messaging. Each room now creates its own XMTP group where all participants (hosts, speakers, and listeners) are automatically added as they join.

## What Was Changed

### Frontend Changes

#### 1. **New Files Created**

**`contexts/XMTPContext.tsx`** - XMTP Client Provider
- Initializes XMTP client using wagmi wallet connection
- Handles wallet signatures for XMTP identity
- Auto-connects when wallet is available
- Provides client state to entire app

**`hooks/useXMTPRoomGroup.ts`** - Room Group Manager
- Creates optimistic XMTP groups for room hosts
- Finds existing groups for participants
- Manages adding members by wallet address
- Persists room-to-group mapping in localStorage
- Key functions:
  - `createGroup()` - Host creates new group
  - `addMember(address)` - Add single participant
  - `addMembers(addresses[])` - Batch add participants

**`hooks/useXMTPMessages.ts`** - Message Streaming Hook
- Loads historical messages from XMTP
- Streams real-time messages as they arrive
- Sends text messages to group
- Handles pagination with `loadMoreMessages()`
- Returns: `messages`, `sendMessage()`, `isLoading`, `error`

**`utils/xmtp/inboxResolver.ts`** - Address to Inbox ID Resolution
- Converts wallet addresses to XMTP inbox IDs
- Uses `Client.canMessage()` to check XMTP capability
- Caches resolutions to avoid redundant lookups
- Handles batch address resolution efficiently

**`components/ParticipantSync.tsx`** - Auto-add Participants
- Monitors HMS peer joins/leaves
- Automatically adds participants to XMTP group
- Only active for room hosts
- Extracts wallet from peer metadata
- Tracks processed peers to avoid duplicates

**`.env.xmtp.example`** - Configuration Template
```env
NEXT_PUBLIC_XMTP_ENV=dev  # or 'production' for mainnet
```

#### 2. **Modified Files**

**`components/Chat.tsx`** - Complete Rewrite
- **Removed**: 100ms `useHMSStore(selectHMSMessages)`, `hmsActions.sendBroadcastMessage()`
- **Removed**: Redis `fetchChatMessages()`, `sendChatMessage()` API calls
- **Added**: XMTP hooks (`useXMTP`, `useXMTPRoomGroup`, `useXMTPMessages`)
- **New Props**: `roomName`, `roomImageUrl`, `isHost`
- **New States**: 
  - XMTP initializing (wallet signature prompt)
  - Group creation (host creates, participants wait)
  - XMTP-specific error handling
- Messages now come from `xmtpMessages` stream instead of HMS/Redis combination

**`components/ChatMessage.tsx`** - Simplified
- **Removed**: Dual HMS/Redis message type handling
- **Removed**: `convertToRedisFormat()` conversion logic
- Now only accepts `RedisChatMessage` format (which XMTP messages are transformed to)
- Cleaner component with single message type

**`components/Footer.tsx`** - Integration Point
- Added `<ParticipantSync>` component for auto-adding members
- Updated `<Chat>` props to include room metadata and host status
- Pass `isHost={localPeer?.roleName?.toLowerCase() === 'host'}`

**`utils/providers/providers.tsx`** - Provider Chain
- Added `<XMTPProvider>` wrapped around HMS
- Provider order: `WagmiQueryProvider` → `XMTPProvider` → `HMSRoomProvider`
- XMTP initializes after wallet connection

**`types/index.d.ts`** - Type Updates
- Added deprecation comment to `RedisChatMessage` type
- Added `XMTPConfig` interface
- Documented migration to XMTP

### Backend Changes

#### 1. **Files Deleted**
- ❌ `apps/backend/src/routes/rooms/chat.ts` - Chat API routes removed
- ❌ `apps/backend/src/services/redis/chat.ts` - Redis chat service removed

#### 2. **Modified Files**

**`apps/backend/src/routes/rooms/index.ts`**
- Removed `chatRoutes` import and usage
- Updated documentation to reflect chat removal

**`apps/backend/src/services/redis/index.ts`**
- Removed `RedisChatService` export
- Other Redis services (participants, room stats) remain intact

**`apps/web/utils/serverActions.ts`**
- Deprecated `fetchChatMessages()` and `sendChatMessage()`
- Functions now return error indicating migration to XMTP
- Kept for backwards compatibility (prevents breaking tipping feature)

## How It Works

### Architecture Flow

```
User Joins Room
     ↓
Wallet Connected (via wagmi)
     ↓
XMTP Client Initialized (XMTPContext)
     ↓
User Signs Message (one-time XMTP identity)
     ↓
Host Creates Optimistic Group (useXMTPRoomGroup)
     ↓
Participant Added to HMS Room
     ↓
ParticipantSync extracts wallet from peer metadata
     ↓
Wallet → Inbox ID Resolution (inboxResolver)
     ↓
addMember() adds to XMTP Group
     ↓
Messages Stream via useXMTPMessages
```

### Message Flow

**Sending:**
1. User types message in Chat component
2. `sendMessage(text)` from `useXMTPMessages` hook
3. `group.sendText(text)` sends to XMTP network
4. Message auto-appears in sender's stream
5. All group members receive via their message streams

**Receiving:**
1. `group.streamMessages()` creates real-time stream
2. `onValue` callback fires for each new message
3. Messages added to local state
4. Chat UI auto-updates
5. Historical messages loaded on mount via `group.messages()`

### Group Management

**Host:**
- Creates optimistic XMTP group when room starts
- Group stored locally until first member added
- Adding members syncs group to network
- Group metadata: name=`Room ${roomId}`, description, imageUrl

**Participants:**
- Check for existing group via `findExistingGroup()`
- Wait for host to create if doesn't exist
- Auto-added by `ParticipantSync` component
- Inbox ID resolved from wallet address

**Persistence:**
- Room-to-group mapping: `localStorage.setItem('xmtp_room_group_{roomId}', groupId)`
- Messages: XMTP network (permanent, not 24hr Redis TTL)
- Client state: IndexedDB (`xmtp.db`)

## Key Features

✅ **End-to-End Encrypted**: XMTP provides native E2E encryption  
✅ **Permanent Storage**: Messages persist beyond room lifecycle  
✅ **Decentralized**: No backend chat service needed  
✅ **Real-time Streaming**: Comparable to 100ms broadcast messages  
✅ **Optimistic Creation**: Instant group availability for hosts  
✅ **Automatic Sync**: Participants auto-added via HMS peer events  
✅ **Wallet-Based**: Leverages existing Farcaster wallet connection  
✅ **Cross-Platform**: Messages accessible from any XMTP client  

## Configuration

### Environment Variables
Add to `.env.local`:
```env
NEXT_PUBLIC_XMTP_ENV=dev  # Use 'production' for mainnet
```

### Wallet Requirements
- Users must have wallet connected (already required for Farcaster Miniapp)
- First-time XMTP users will sign message to create XMTP identity
- Signature is one-time per wallet (subsequent logins use local DB)

## Testing Checklist

- [ ] Install dependencies: `cd apps/web && npm install`
- [ ] Set env variable: `NEXT_PUBLIC_XMTP_ENV=dev`
- [ ] Connect wallet in miniapp
- [ ] Sign XMTP message when prompted
- [ ] Host creates room → XMTP group created
- [ ] Participant joins → automatically added to group
- [ ] Send message from both users → appears in real-time
- [ ] Refresh page → message history persists
- [ ] Check browser console for XMTP logs
- [ ] Check IndexedDB for `xmtp.db` database
- [ ] Verify 100+ participant rooms work (within 250 limit)

## Known Limitations

1. **Group Size**: XMTP groups limited to 250 members max
   - Solution: Current implementation assumes rooms stay under 250
   - Future: Could implement multiple groups or listener-only mode

2. **Reply Functionality**: Currently disabled (TODO)
   - XMTP supports custom content types for replies
   - Requires implementing reply content type

3. **Message Latency**: ~500ms-2s vs 100ms instant broadcast
   - Trade-off: Persistence and decentralization vs instant delivery
   - Acceptable for chat use case

4. **Inbox ID Resolution**: Additional lookup step
   - Cached to minimize redundant calls
   - `Client.canMessage()` checks XMTP capability
   - Users without XMTP skipped gracefully

5. **First-Time User Experience**:
   - Requires wallet signature on first use
   - Loading state shown during initialization
   - Clear UX prompts user to sign

## Migration Notes

### For Existing Rooms
- Old Redis messages are NOT migrated to XMTP
- New rooms use XMTP exclusively
- Chat history starts fresh when XMTP is enabled
- Consider keeping Redis read-only for historical data

### Backwards Compatibility
- `RedisChatMessage` type kept for compatibility
- `sendChatMessage()` and `fetchChatMessages()` deprecated but present
- TippingModal still uses these functions (update separately if needed)

## Troubleshooting

**"XMTP client not initialized"**
- Ensure wallet is connected
- Check that user signed XMTP message
- Verify `NEXT_PUBLIC_XMTP_ENV` is set

**"Chat not ready"**
- Host must create group first
- Check browser console for group creation logs
- Verify `isHost` prop passed correctly

**"Failed to add member"**
- User may not have XMTP identity yet
- Wallet address may be missing from peer metadata
- Check inbox resolver logs

**Messages not appearing**
- Check message stream is active
- Verify group is synced (`group.sync()`)
- Inspect browser console for stream errors

**Signature rejected**
- User must accept wallet signature request
- Required for first-time XMTP setup
- Cannot use XMTP without signature

## Next Steps / Future Enhancements

1. **Reply Functionality**
   - Implement XMTP custom content type for replies
   - Add reply metadata to message payload
   - Update ChatMessage to display reply threads

2. **Read Receipts**
   - Track message read status
   - Show "seen by X users" indicators
   - Use XMTP consent/read state

3. **Typing Indicators**
   - Use XMTP group status updates
   - Show "User is typing..." in chat

4. **Rich Media**
   - Implement XMTP attachment content type
   - Support images, GIFs, videos in chat
   - Use remote attachment encryption

5. **Moderation**
   - Host can remove members from group
   - Implement block/report functionality
   - Use XMTP consent preferences

6. **Multi-Group Support**
   - Handle rooms with >250 participants
   - Create sub-groups or listener-only mode
   - Implement group sharding

7. **Message Search**
   - Index messages in IndexedDB
   - Implement client-side search
   - Filter by sender, date, content

8. **Notifications**
   - Integrate XMTP push notifications
   - Alert users of new messages when offline
   - Badge count for unread messages

## File Structure

```
apps/web/
├── contexts/
│   └── XMTPContext.tsx           # XMTP client provider
├── hooks/
│   ├── useXMTPRoomGroup.ts       # Group management
│   └── useXMTPMessages.ts        # Message streaming
├── utils/
│   └── xmtp/
│       └── inboxResolver.ts      # Address → Inbox ID
├── components/
│   ├── Chat.tsx                  # Main chat UI (updated)
│   ├── ChatMessage.tsx           # Message display (simplified)
│   ├── Footer.tsx                # Integration point (updated)
│   └── ParticipantSync.tsx       # Auto-add members
├── types/
│   └── index.d.ts                # Type definitions (updated)
└── .env.xmtp.example             # Config template

apps/backend/
├── src/
│   ├── routes/rooms/
│   │   └── index.ts              # Removed chatRoutes
│   └── services/redis/
│       └── index.ts              # Removed RedisChatService
```

## Dependencies Added

```json
{
  "@xmtp/browser-sdk": "^6.3.0"
}
```

Existing dependencies used:
- `wagmi` - Wallet connection
- `viem` - Ethereum utilities
- `@100mslive/react-sdk` - Room/peer management (still used for calls)

---

**Implementation Status**: ✅ Complete  
**Testing Status**: ⏳ Pending user testing  
**Production Ready**: 🟡 Needs testing and env configuration  
**Breaking Changes**: ⚠️ Yes - old chat messages not accessible

---

**Contact**: For questions about XMTP integration, refer to:
- XMTP Docs: https://docs.xmtp.org
- Browser SDK Reference: https://github.com/xmtp/xmtp-web
- XMTP Discord: https://discord.gg/xmtp
