# Audio Issue Investigation Log

## The Problem (Deterministic)

**Scenario**: 3 participants join a room
- Person A joins first
- Person B joins second  
- Person C joins third
- Person C starts talking
- Person A mutes

**Result**: 
- Person B cannot hear Person C (audio indicator shows, but no sound)
- Person C shows as speaking but person B gets no audio

**When I added `setVolume(100)` code**:
- Problem FLIPPED: Person C couldn't hear Person B
- This means my approach made it worse

**After commenting out**:
- Problem returned to original: Person B can't hear Person C

## Key Findings

### The Flip
The fact that calling `setVolume(100)` on all remote peers **flipped** which person lost audio is very revealing. This suggests:
1. We're interfering with HMS's internal audio routing
2. The order of `setVolume()` calls matters
3. We might be triggering re-subscription/resubscription in a way that disrupts OTHER participants

### Current Mute Implementation
```typescript
// Person A toggles audio
hmsActions.setLocalAudioEnabled(false);  // via toggleAudio() from useAVToggle
```

This is the standard 100ms approach and SHOULD work.

### What We Know
- The issue is **deterministic** - always happens when Person A mutes in this sequence
- Audio indicator still shows (tracks are active)
- But no actual audio output reaches other participants
- Only affects SOME participants, not all
- **Order matters**: A->B->C, A mutes, B loses C

### Hypothesis
This might be related to:
1. **Track ID state**: When Person A mutes, their track changes state, which might trigger HMS to reorganize the audio sink graph
2. **Subscription order**: The order of subscription might matter. A joined first, so they might have different track IDs or subscription state
3. **Web Audio sink management**: In PWA environments, the Web Audio sink nodes get reorganized when someone mutes, and this disrupts the audio routing for OTHER participants

### What To Check Next
- Log track IDs before/after mute
- Log which peers are subscribing to which tracks  
- See if there's a pattern in track subscription order
- Check if this is a 100ms SDK internal issue with how it manages audio sinks in PWA

