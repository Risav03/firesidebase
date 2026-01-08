# RealtimeKit Migration Documentation

## Overview

This document details the migration from **100ms SDK** to **Cloudflare RealtimeKit** for the Fireside audio rooms application.

**Branch:** `call-client`  
**Status:** Phase 1-5 Complete, Phase 6-8 Pending

---

## What Has Been Achieved ✅

### Phase 1: RealtimeKit Infrastructure Setup
- **File:** `apps/web/utils/providers/realtimekit.tsx`
- Created `RealtimeKitProvider` wrapper component
- Implemented `useRealtimeKit()` hook exposing:
  - `meeting` - RealtimeKit meeting instance
  - `initAndJoin()` - Combined init + join (prevents race conditions)
  - `leaveRoom()` - Leave meeting
  - `isConnected` - Connection state
  - `isJoining` - Join in progress state
  - `error` - Error state

### Phase 2: Room Join/Leave Migration
- **Backend File:** `apps/backend/src/routes/rooms/integrations.ts`
  - `/protected/:id/rtk-token` - Get RealtimeKit auth token
  - `/protected/:id/rtk-kick` - Kick participant
  - `/protected/:id/rtk-role` - Change participant role
  - `/protected/:id/rtk-end` - End meeting
- **Backend File:** `apps/backend/src/services/realtimekitAPI.ts`
  - `createMeeting()` - Create RTK meeting
  - `addParticipant()` - Add participant with preset
  - `getParticipantToken()` - Get auth token
  - `kickParticipant()` - Remove participant
  - `updateParticipantPreset()` - Change role
  - `endMeeting()` - End meeting
  - `listParticipants()` - Get participant list
- **Backend File:** `apps/backend/src/routes/rooms/room-management.ts`
  - Room creation now creates RTK meeting (not 100ms)
  - Room start creates RTK meeting if not exists
  - `rtkMeetingId` stored in Room model

### Phase 3: Peer Management Migration
- **File:** `apps/web/utils/providers/realtimekit-hooks.ts`
  - `useParticipants()` - Get all participants
  - `useLocalParticipant()` - Get local participant
  - `getParticipantsArray()` - Convert to array with `.toArray()`
  - `getParticipantRole()` - Get role from preset
  - `isHostOrCohost()` - Permission check
- **File:** `apps/web/components/ConferenceRTK.tsx`
  - Replaced 100ms peer selectors with RTK hooks
  - Peer sorting by role (host → co-host → speaker → listener)
  - Loading state while connecting

### Phase 4: Chat Migration
- **File:** `apps/web/components/ChatRTK.tsx`
  - Uses `meeting.chat.sendTextMessage()` for broadcast
  - Listens to `meeting.chat.on('chatUpdate')` for messages
  - Integrates with Redis for chat persistence
- **Files Updated:**
  - `TippingModal.tsx` - Uses RTK chat for tip notifications
  - `TippingDrawer.tsx` - Uses RTK chat for tip notifications

### Phase 5: Stage Management (Speaker/Listener Flow)
- **File:** `apps/web/utils/providers/realtimekit-hooks.ts`
  - `useStageRequests()` - Handle hand raise requests
  - `useStageManagement()` - Full stage control for hosts
  - `useStageEvents()` - Listen for stage events
  - Stage status: `ON_STAGE`, `OFF_STAGE`, `REQUESTED_TO_JOIN_STAGE`, `ACCEPTED_TO_JOIN_STAGE`

### Role Assignment Logic
- **Backend:** `apps/backend/src/routes/rooms/integrations.ts`
  - Room creator → `host` preset
  - Existing participant with role → mapped preset
  - Everyone else → `listener` preset (default)

### RTK Component Files Created
| Component | File | Replaces |
|-----------|------|----------|
| CallClient | `components/CallClientRTK.tsx` | `CallClient.tsx` |
| Conference | `components/ConferenceRTK.tsx` | `Conference.tsx` |
| Header | `components/HeaderRTK.tsx` | `Header.tsx` |
| Footer | `components/FooterRTK.tsx` | `Footer.tsx` |
| Chat | `components/ChatRTK.tsx` | `Chat.tsx` |
| RoleChangeHandler | `components/RoleChangeHandlerRTK.tsx` | `RoleChangeHandler.tsx` |
| UserContextMenu | `components/UserContextMenuRTK.tsx` | `UserContextMenu.tsx` |

### Stub Implementations (Pending Full Migration)
| Feature | Stub File | Status |
|---------|-----------|--------|
| Emoji Reactions | `components/footer/useEmojiReactionLogicRTK.ts` | Local only, no broadcast |
| Soundboard | `components/footer/useSoundboardLogicRTK.ts` | Disabled |

---

## What's Left to Do 🔄

### Phase 6: Custom Events Layer (Emoji Reactions)
**Priority: Medium**

Currently emoji reactions show locally but don't broadcast to other participants.

**Implementation needed:**
1. Create a custom events system using RTK chat with JSON payloads
2. Update `useEmojiReactionLogicRTK.ts` to:
   - Send: `meeting.chat.sendTextMessage(JSON.stringify({ type: 'EMOJI', emoji, sender }))`
   - Receive: Parse incoming chat messages for `type: 'EMOJI'`

**Reference:** [RealtimeKit Chat API](https://developers.cloudflare.com/realtime/realtimekit/core/chat/)

### Phase 7: Hand Raise via Stage Management
**Priority: High**

Hand raise button works visually but stage management may not be enabled in presets.

**Implementation needed:**
1. Enable Stage Management in Cloudflare RealtimeKit dashboard presets
2. Configure which presets can:
   - Request stage access (listeners)
   - Grant/deny access (hosts, co-hosts)
3. Test `meeting.stage.requestAccess()` and `meeting.stage.grantAccess()`

**Reference:** [RealtimeKit Stage Management](https://developers.cloudflare.com/realtime/realtimekit/core/stage-management/)

### Phase 8: Soundboard & Custom Audio
**Priority: Low**

Soundboard is currently disabled.

**Implementation needed:**
1. Research RTK custom audio track injection
2. Create synchronized sound playback across peers
3. Update `useSoundboardLogicRTK.ts`

### Phase 9: Cleanup
**Priority: After Testing**

Once RTK is fully working:
1. Remove 100ms SDK dependencies from `package.json`
2. Delete deprecated 100ms components
3. Remove `HMSRoomProvider` references
4. Clean up commented-out code

---

## Configuration Required

### Environment Variables

**Backend (`apps/backend/.env`):**
```env
RTK_API_KEY=your_realtimekit_api_key
RTK_ORG_ID=your_organization_id
RTK_BASE_URL=https://api.realtime.cloudflare.com/v2
```

### RealtimeKit Dashboard Setup

1. Go to [dash.realtime.cloudflare.com](https://dash.realtime.cloudflare.com)
2. Create/configure presets:
   - `host` - Full permissions, can produce audio/video, manage stage
   - `co-host` - Full permissions, can produce audio/video, manage stage
   - `speaker` - Can produce audio, on stage by default
   - `listener` - Cannot produce initially, can request stage access

3. **Enable Stage Management** in preset settings for hand raise to work

---

## Key API Differences: 100ms vs RealtimeKit

| Feature | 100ms | RealtimeKit |
|---------|-------|-------------|
| Join Room | `hmsActions.join({ authToken })` | `meeting.join({ authToken })` |
| Leave Room | `hmsActions.leave()` | `meeting.leave()` |
| Get Peers | `selectPeers` selector | `meeting.participants.joined.toArray()` |
| Local Peer | `selectLocalPeer` | `meeting.self` |
| Mute/Unmute | `hmsActions.setLocalAudioEnabled()` | `meeting.self.enableAudio()` / `disableAudio()` |
| Send Chat | `hmsActions.sendBroadcastMessage()` | `meeting.chat.sendTextMessage()` |
| Hand Raise | `hmsActions.raiseLocalPeerHand()` | `meeting.stage.requestAccess()` |
| Role Change | `hmsActions.changeRole()` | Backend API + new token |
| Kick | `hmsActions.removePeer()` | `meeting.participants.kick()` or Backend API |
| Room Joined Event | `HMSNotificationTypes.ROOM_JOINED` | `meeting.self.on('roomJoined')` |
| Peer Joined Event | `HMSNotificationTypes.PEER_JOINED` | `meeting.participants.on('participantJoined')` |

---

## Testing Checklist

### Core Flow
- [ ] Create a new room as host
- [ ] Host joins and sees themselves
- [ ] Second user joins as listener
- [ ] Host can see listener in participant list
- [ ] Chat messages work bidirectionally
- [ ] Host can mute/unmute
- [ ] Host can kick participant
- [ ] Host can promote listener to speaker
- [ ] Host can end room for everyone

### Hand Raise Flow (Requires Stage Management enabled)
- [ ] Listener can raise hand
- [ ] Host sees hand raise notification
- [ ] Host can accept/reject request
- [ ] Accepted listener becomes speaker

### Edge Cases
- [ ] Rejoin after disconnect
- [ ] Multiple participants (3+)
- [ ] Role changes propagate correctly

---

## File Structure

```
apps/web/
├── components/
│   ├── CallClientRTK.tsx      # Main room join component
│   ├── ConferenceRTK.tsx      # Participant grid
│   ├── HeaderRTK.tsx          # Room header + leave/end
│   ├── FooterRTK.tsx          # Controls (mute, hand raise, etc)
│   ├── ChatRTK.tsx            # Chat component
│   ├── RoleChangeHandlerRTK.tsx
│   ├── UserContextMenuRTK.tsx
│   └── footer/
│       ├── useEmojiReactionLogicRTK.ts  # Stub
│       └── useSoundboardLogicRTK.ts     # Stub
├── utils/
│   └── providers/
│       ├── realtimekit.tsx    # Provider + context
│       └── realtimekit-hooks.ts # All RTK hooks

apps/backend/
├── src/
│   ├── services/
│   │   └── realtimekitAPI.ts  # RTK REST API client
│   ├── routes/
│   │   └── rooms/
│   │       ├── integrations.ts    # Token, kick, role endpoints
│   │       └── room-management.ts # Room CRUD with RTK
│   └── config/
│       └── index.ts           # RTK config (API key, org ID)
```

---

## Known Issues

1. **Stage Management "disabled" warning**: Presets need Stage Management enabled in Cloudflare dashboard
2. **Emoji reactions local-only**: Needs Phase 6 implementation
3. **Soundboard disabled**: Needs Phase 8 implementation
4. **Merge conflicts with main**: The `call-client` branch has conflicts with `main` that need manual resolution

---

## Next Steps for New Chat Session

1. **Resolve merge conflicts** between `call-client` and `main`
2. **Enable Stage Management** in Cloudflare RealtimeKit dashboard
3. **Test core flow** (create room → join → chat → leave)
4. **Implement Phase 6** (emoji broadcast via chat)
5. **Remove 100ms dependencies** once fully tested

---

*Last Updated: January 6, 2026*

