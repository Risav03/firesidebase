
// Legacy chat message type - kept for backwards compatibility
// New XMTP-based chat uses XMTPMessageWithMetadata from hooks/useXMTPMessages.ts
type RedisChatMessage = {
    id: string;
    roomId: string;
    userId: string;
    username: string;
    displayName: string;
    pfp_url: string;
    message: string;
    timestamp: string;
    replyTo?: {
        messageId: string;
        message: string;
        username: string;
        pfp_url: string;
    };
}

type RoomParticipant = {
    userId: string;
    username: string;
    displayName: string;
    pfp_url: string;
    wallet: string;
    role: 'host' | 'co-host' | 'speaker' | 'listener';
    status: 'active' | 'inactive';
    joinedAt: string;
}

// XMTP Configuration
interface XMTPConfig {
    env: 'production' | 'dev';
    dbPath?: string;
}