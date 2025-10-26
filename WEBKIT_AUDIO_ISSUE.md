# WebKit Mobile Audio Issue

## Scope Confirmed

**NOT just PWA** - This affects ANY mobile WebKit environment:
- iOS Safari
- Chrome on iOS (uses WebKit)
- Any mobile browser using WebKit

When someone mutes in a WebKit mobile browser:
- Other participants lose audio from remaining speakers
- Audio indicators still show (track is active)
- But no actual audio reaches other participants

## The Problem

1. 3+ participants join
2. Someone speaks (audio indicator shows)
3. Another participant mutes
4. **Other participants can no longer hear the speaker**
5. Speaker's audio indicator still shows they're talking
6. But audio is silent for others

## Why WebKit is Different

WebKit handles WebRTC audio differently than desktop browsers:
- Different audio sink management
- Stricter audio context handling
- More aggressive resource management
- Known issues with track re-subscription

## Logging Added

We now have comprehensive logging that will show:
- Exact join order of all peers
- Track IDs before and after mute
- Whether track IDs change
- Whether subscription state changes
- If HMS SDK is managing tracks correctly

## Next Steps

Run the test with the logging enabled and check:
1. Do track IDs change when someone mutes?
2. Do track subscription states change?
3. Is it the same participant losing audio every time?
4. Does it depend on join order?

The logs will show us if this is:
- 100ms SDK bug (tracks getting unsubscribed)
- WebKit bug (audio sink routing breaking)
- Our implementation issue (something we're doing wrong)

## Testing Command

1. Clear browser console
2. Join 3 people on mobile WebKit browsers
3. Have someone talk
4. Have someone mute
5. Copy ALL console logs
6. Look for `[AUDIO DEBUG]` entries

