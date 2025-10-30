
type RedisChatMessage = {
    id: string;
    roomId: string;
    userId: string;
    username: string;
    displayName: string;
    pfp_url: string;
    message: string;
    timestamp: string;
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

// Ambient module declarations for external SDKs without shipped types
declare module "agora-rtc-sdk-ng";
declare module "agora-rtc-react";
declare module "agora-rtm-sdk";