# Role-Based Permissions System

## Overview

This document explains how the role-based permissions system works in the Fireside application, which solves the issue where users couldn't regain audio permissions after being downgraded to a listener role.

## The Problem

Previously, when a user's role was changed dynamically (e.g., from host → speaker → listener → host), the 100ms SDK didn't automatically refresh the UI permissions. This caused:

1. **Host → Speaker**: ✅ Worked (same-level downgrade kept publish permissions)
2. **Speaker → Listener**: ✅ Worked (lost publish permissions correctly)
3. **Listener → Host**: ❌ Failed (permissions never reapplied in UI)
4. **Listener → Speaker**: ❌ Failed (permissions never reapplied in UI)

## The Solution

The new system implements a comprehensive role change detection and permission management system:

### 1. Automatic Role Detection (Footer.tsx)

The Footer component now:
- Monitors the local peer's role changes
- Automatically updates UI permissions based on role
- Disables/enables audio controls appropriately
- Re-enables audio when permissions are restored

```typescript
// Function to update permissions based on role
const updatePermissionsForRole = (role: string) => {
  let canToggle = false;
  
  switch (role.toLowerCase()) {
    case 'host':
    case 'speaker':
      canToggle = true;
      break;
    case 'listener':
      canToggle = false;
      break;
    default:
      canToggle = false;
  }
  
  setCanToggleAudio(canToggle);
  
  // If we regained permissions and audio was muted, re-enable it
  if (canToggle && !isLocalAudioEnabled && localPeer && actions) {
    setTimeout(() => {
      actions.setLocalAudioEnabled(true);
    }, 100);
  }
};
```

### 2. Periodic Role Checking (page.tsx)

The main call page now:
- Checks for role updates every 10 seconds
- Automatically re-joins the room with the new role when changes are detected
- Handles the complete room reconnection process

```typescript
// Function to check and update role if needed
const checkAndUpdateRole = async () => {
  // Fetch current room details to check user's role
  const roomResponse = await fetch(`/api/rooms/${roomId}`);
  const roomData = await roomResponse.json();
  
  // Determine what role the user should have
  let targetRole = 'listener';
  if (roomData.room.host._id === user._id) {
    targetRole = 'host';
  }
  
  // If role changed, re-join with new role
  if (targetRole !== currentRole && targetRole !== '') {
    await hmsActions.leave();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await joinRoomWithRole(targetRole);
  }
};
```

### 3. Visual Role Status (Conference.tsx)

The Conference component now displays:
- Current user role
- Permission status (Can Speak/Can Listen)
- Helpful tips for listeners

### 4. Manual Refresh (Header.tsx)

The Header component now includes:
- A refresh button to manually trigger role checks
- Current role display
- Visual feedback during refresh operations

## How It Works

### 1. Initial Join
- User joins room with appropriate role code
- Permissions are set based on initial role
- UI reflects current permissions

### 2. Role Change Detection
- System polls for role updates every 10 seconds
- When a role change is detected:
  - Current room connection is closed
  - User re-joins with new role code
  - New permissions are applied
  - UI updates automatically

### 3. Permission Management
- **Host/Speaker**: Full audio control (mute/unmute)
- **Listener**: No audio control (button disabled)
- **Automatic Recovery**: When permissions are restored, audio is automatically re-enabled

## Testing the System

### Test Scenario 1: Host → Listener → Host
1. Start as host (can mute/unmute)
2. Change role to listener via API (button becomes disabled)
3. Change role back to host via API
4. System automatically detects change and re-joins
5. Audio controls are restored

### Test Scenario 2: Speaker → Listener → Speaker
1. Start as speaker (can mute/unmute)
2. Change role to listener via API (button becomes disabled)
3. Change role back to speaker via API
4. System automatically detects change and re-joins
5. Audio controls are restored

## API Endpoints

The system works with your existing role update API endpoints. When you change a user's role via Postman or any other method:

1. **Update user role** in your database
2. **System detects change** within 10 seconds
3. **Automatic re-join** with new role
4. **Permissions updated** in real-time

## Manual Refresh

Users can also manually trigger a role check by:
1. Clicking the refresh button in the header
2. This will reload the page and re-check all permissions
3. Useful for immediate role verification

## Configuration

### Role Check Interval
```typescript
// Check for role updates every 10 seconds
roleCheckInterval.current = setInterval(checkAndUpdateRole, 10000);
```

### Throttling
```typescript
// Throttle role checks to avoid too many API calls
if (now - lastRoleCheck.current < 5000) { // 5 second throttle
  return;
}
```

## Troubleshooting

### Issue: Role not updating
- Check browser console for error messages
- Verify API endpoints are working
- Use manual refresh button
- Check network tab for failed requests

### Issue: Permissions not restored
- Ensure role change was successful in database
- Wait for automatic detection (up to 10 seconds)
- Check if user has valid room codes for new role
- Verify 100ms room configuration

### Issue: Audio not working after role change
- Check if audio permissions were granted
- Verify microphone access in browser
- Check 100ms room settings
- Try manual refresh

## Benefits

1. **Seamless Role Changes**: No more manual page refreshes
2. **Real-time Permissions**: UI updates immediately when roles change
3. **Automatic Recovery**: Audio permissions are restored automatically
4. **Better UX**: Users always know their current permissions
5. **Robust Error Handling**: Graceful fallbacks for failed operations

## Future Enhancements

1. **WebSocket Integration**: Real-time role updates instead of polling
2. **Role Change Notifications**: In-app notifications when roles change
3. **Permission History**: Track role changes over time
4. **Advanced Permissions**: More granular control over capabilities
5. **Role Templates**: Predefined permission sets for different roles
