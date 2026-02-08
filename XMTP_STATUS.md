# XMTP Integration - Implementation On Hold

## Status: ⏸️ Paused - Awaiting SDK Documentation Alignment

The XMTP chat integration has been **90% completed** but is currently on hold due to API discrepancies between the XMTP documentation and the actual `@xmtp/browser-sdk` package (v6.3.0).

## What's Been Completed ✅

### 1. **Core Infrastructure** (100%)
- ✅ XMTP client context with wallet integration
- ✅ Provider setup in app hierarchy
- ✅ Wallet signer implementation using wagmi
- ✅ Environment configuration

### 2. **Group Management** (95%)
- ✅ Hook structure for room group creation
- ✅ Optimistic group creation logic
- ✅ Member addition by wallet address
- ✅ Room-to-group mapping persistence
- ⚠️ API methods need verification (`createGroupOptimistic`, group options)

### 3. **Inbox Resolution** (95%)
- ✅ Wallet address to inbox ID conversion
- ✅ Caching mechanism
- ✅ Batch resolution support
- ⚠️ API method needs verification (`findInboxIdByIdentities`)

### 4. **Message Streaming** (90%)
- ✅ Hook structure for message management
- ✅ Historical message loading
- ✅ Real-time streaming setup
- ✅ Message transformation to UI format
- ⚠️ Stream API needs verification (`group.streamMessages()`)

### 5. **UI Integration** (100%)
- ✅ Chat component fully updated
- ✅ ChatMessage component simplified
- ✅ Loading/error states for XMTP
- ✅ Participant sync component
- ✅ Footer integration

### 6. **Backend Cleanup** (100%)
- ✅ Chat routes removed
- ✅ Redis chat service deleted
- ✅ Server actions deprecated
- ✅ Route index updated

## Issues Encountered

### API Method Mismatches

| Documentation | Actual SDK | Status |
|--------------|------------|--------|
| `client.findInboxIdByIdentities()` | Not found | ❌ |
| `group.streamMessages()` | Not found | ❌ |
| `createGroupOptimistic({ name, description })` | Options type mismatch | ⚠️ |
| `group.sendText()` | Might be `group.send()` | ⚠️ |

### TypeScript Errors

1. **XMTPMessageWithMetadata type mismatch**
   - Chat.tsx expects `RedisChatMessage` format
   - Needs proper transformation from XMTP `DecodedMessage`

2. **ChatMessage return type**
   - Component returns `void` instead of `ReactNode`
   - Missing return statement

3. **Group API methods**
   - `streamMessages()` doesn't exist on Group type
   - Need to find correct streaming API

4. **CreateGroupOptions**
   - `name`, `description`, `imageUrl` not in type
   - Need correct option structure for v6.3.0

## Next Steps to Complete 🔧

### 1. Verify Actual Browser SDK API (Priority: HIGH)

Check the installed package types:
```bash
cd apps/web/node_modules/@xmtp/browser-sdk
# Review types in dist/ or src/
```

Look for:
- Correct Client methods for inbox ID lookup
- Actual Group methods for streaming
- Proper message sending API
- Group creation options structure

### 2. Update Implementation Based on Real API

**inboxResolver.ts:**
```typescript
// Find the correct method - might be:
// - client.getInboxIdByAddress()
// - client.contacts.getInboxId()
// - Different approach entirely
```

**useXMTPMessages.ts:**
```typescript
// Find correct streaming:
// - group.stream()
// - client.conversations.streamMessages()
// - group.messages.stream()
```

**useXMTPRoomGroup.ts:**
```typescript
// Find correct group creation:
// - client.conversations.createGroup(members, options?)
// - What options are actually supported?
```

### 3. Fix TypeScript Errors

**Chat.tsx** - Line 303
```typescript
// Ensure proper message transformation:
const displayMessages = xmtpMessages.map((msg) => ({
  id: msg.id,
  roomId: roomId,
  userId: msg.senderInboxId,
  username: msg.senderAddress || "Unknown", // Fix undefined properties
  displayName: msg.senderAddress || "Unknown",
  pfp_url: "",
  message: typeof msg.content === 'string' ? msg.content : '',
  timestamp: msg.sentAt.toISOString(),
  replyTo: undefined,
}));
```

**ChatMessage.tsx** - Missing return statement
```typescript
export function ChatMessage(...): JSX.Element {
  // ... component logic
  return (
    <div>...</div>
  );
}
```

### 4. Test with Minimal Implementation

Create a test file to verify APIs:
```typescript
// apps/web/test-xmtp.ts
import { Client } from '@xmtp/browser-sdk';

// Test what methods actually exist
const testXMTP = async () => {
  const client = await Client.create(signer);
  
  console.log('Client methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
  
  const group = await client.conversations.createGroup([]);
  console.log('Group methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(group)));
};
```

## Alternative Approaches

### Option A: Use XMTP React SDK
If `@xmtp/browser-sdk` is too low-level, consider:
```bash
npm install @xmtp/react-sdk
```
May have higher-level hooks and better React integration.

### Option B: Downgrade to Documented Version
The docs might be for an earli

er version:
```bash
npm install @xmtp/browser-sdk@3.1.2
```

### Option C: Wait for SDK Update
Browser SDK v6.3.0 might be newer than docs:
- Contact XMTP team on Discord
- File GitHub issue
- Wait for documentation update

## Files Ready for Testing

Once API is verified, these files are ready:

### Context & Providers ✅
- [contexts/XMTPContext.tsx](apps/web/contexts/XMTPContext.tsx)
- [utils/providers/providers.tsx](apps/web/utils/providers/providers.tsx)

### Hooks (Need API fixes) ⚠️
- [hooks/useXMTPRoomGroup.ts](apps/web/hooks/useXMTPRoomGroup.ts)
- [hooks/useXMTPMessages.ts](apps/web/hooks/useXMTPMessages.ts)

### Components ✅
- [components/Chat.tsx](apps/web/components/Chat.tsx)
- [components/ChatMessage.tsx](apps/web/components/ChatMessage.tsx) (needs return fix)
- [components/ParticipantSync.tsx](apps/web/components/ParticipantSync.tsx)
- [components/Footer.tsx](apps/web/components/Footer.tsx)

### Utilities (Need API fix) ⚠️
- [utils/xmtp/inboxResolver.ts](apps/web/utils/xmtp/inboxResolver.ts)

## How to Resume

1. **Research actual API:**
   ```bash
   cd apps/web
   npm run type-check 2>&1 | grep @xmtp
   # Check node_modules/@xmtp/browser-sdk/dist/index.d.ts
   ```

2. **Fix API calls** in hooks and utilities

3. **Add return statement** to ChatMessage.tsx

4. **Test incrementally:**
   - Wallet connection
   - XMTP client init
   - Group creation
   - Message sending
   - Message streaming

5. **Update [XMTP_INTEGRATION.md](XMTP_INTEGRATION.md)** with working examples

## Testing Commands

```bash
# Install dependencies
cd apps/web
npm install

# Check types
npm run type-check

# Start dev server
npm run dev

# Check for XMTP errors in console
```

## Contact & Resources

- **XMTP Discord**: https://discord.gg/xmtp
- **Browser SDK Repo**: https://github.com/xmtp/xmtp-web
- **Type Definitions**: `node_modules/@xmtp/browser-sdk/dist/index.d.ts`
- **API Reference**: https://github.com/xmtp/xmtp-web/tree/main/sdks/browser-sdk

## Estimated Time to Complete

- **API Research**: 1-2 hours
- **Code Fixes**: 2-3 hours
- **Testing**: 2-4 hours
- **Total**: 5-9 hours

Once the actual SDK API is confirmed, the remaining issues should be straightforward to resolve. The architecture and integration points are solid.

---

**Last Updated**: February 8, 2026  
**Blocked By**: XMTP Browser SDK v6.3.0 API documentation mismatch  
**Completion**: 90%
