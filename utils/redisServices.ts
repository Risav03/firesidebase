import { redis } from './redis';
import { IRoom } from './schemas/Room';
import { IUser } from './schemas/User';

export interface RedisRoom {
    id: string;
    name: string;
    description: string;
    host: {
        fid: string;
        username: string;
        displayName: string;
        pfp_url: string;
    };
    roomId: string;
    status: 'upcoming' | 'ongoing' | 'ended';
    createdAt: string;
}

export interface RedisChatMessage {
    id: string;
    roomId: string;
    userId: string;
    username: string;
    displayName: string;
    pfp_url: string;
    message: string;
    timestamp: string;
}

export interface RoomParticipant {
    userId: string;
    username: string;
    displayName: string;
    pfp_url: string;
    role: 'host' | 'co-host' | 'speaker' | 'listener';
    joinedAt: string;
}

export class RedisRoomService {
    private static ROOM_PREFIX = 'room:';
    private static PARTICIPANTS_PREFIX = 'participants:';

    static async createRoom(roomData: IRoom, hostUser: IUser): Promise<void> {
        const roomId = (roomData as any)._id.toString();
        const redisRoom: RedisRoom = {
            id: roomId,
            name: roomData.name,
            description: roomData.description || '',
            host: {
                fid: hostUser.fid,
                username: hostUser.username,
                displayName: hostUser.displayName,
                pfp_url: hostUser.pfp_url
            },
            roomId: roomData.roomId,
            status: roomData.status,
            createdAt: new Date().toISOString(),
        };

        const roomKey = `${this.ROOM_PREFIX}${roomId}`;
        await redis.setJSON(roomKey, redisRoom, 86400); // 24 hours

        await this.addParticipant(roomId, hostUser, 'host');
    }

    static async getRoom(roomId: string): Promise<RedisRoom | null> {
        const roomKey = `${this.ROOM_PREFIX}${roomId}`;
        return await redis.getJSON<RedisRoom>(roomKey);
    }

    static async addParticipant(roomId: string, user: IUser, role: 'host' | 'co-host' | 'speaker' | 'listener'): Promise<void> {
        const participant: RoomParticipant = {
            userId: user.fid,
            username: user.username,
            displayName: user.displayName,
            pfp_url: user.pfp_url,
            role: role,
            joinedAt: new Date().toISOString()
        };

        const participantKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${user.fid}`;
        await redis.setJSON(participantKey, participant, 86400);
    }

    static async updateParticipantRole(roomId: string, userFid: string, newRole: 'host' | 'co-host' | 'speaker' | 'listener'): Promise<void> {
        const participantKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${userFid}`;
        const participant = await redis.getJSON<RoomParticipant>(participantKey);
        
        if (participant) {
            participant.role = newRole;
            await redis.setJSON(participantKey, participant, 86400);
        }
    }

    static async removeParticipant(roomId: string, userFid: string): Promise<void> {
        const participantKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${userFid}`;
        await redis.del(participantKey);
    }

    static async getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
        const keys = await redis.keys(`${this.PARTICIPANTS_PREFIX}${roomId}:*`);
        const participants: RoomParticipant[] = [];
        
        for (const key of keys) {
            const participant = await redis.getJSON<RoomParticipant>(key);
            if (participant) {
                participants.push(participant);
            }
        }
        
        return participants;
    }

    static async updateRoomStatus(roomId: string, status: 'upcoming' | 'ongoing' | 'ended'): Promise<void> {
        const roomKey = `${this.ROOM_PREFIX}${roomId}`;
        const room = await this.getRoom(roomId);
        
        if (room) {
            room.status = status;
            await redis.setJSON(roomKey, room, status === 'ended' ? 3600 : 86400); // Keep ended rooms for 1 hour
        }
    }
}

export class RedisChatService {
    private static MESSAGE_PREFIX = 'message:';
    private static ROOM_MESSAGES_KEY = (roomId: string) => `chat:${roomId}:messages`;

    static async storeMessage(roomId: string, user: IUser, message: string): Promise<RedisChatMessage> {
        const messageId = `${Date.now()}_${user.fid}`;
        const chatMessage: RedisChatMessage = {
            id: messageId,
            roomId,
            userId: user.fid,
            username: user.username,
            displayName: user.displayName,
            pfp_url: user.pfp_url,
            message: message.trim(),
            timestamp: new Date().toISOString(),
        };

        await redis.setJSON(`${this.MESSAGE_PREFIX}${messageId}`, chatMessage, 86400);
        
        const client = await redis.getClient();
        await client.zadd(
            this.ROOM_MESSAGES_KEY(roomId),
            Date.now(),
            messageId
        );
        
        await redis.expire(this.ROOM_MESSAGES_KEY(roomId), 86400);

        return chatMessage;
    }

    static async getRoomMessages(roomId: string, limit: number = 50, offset: number = 0): Promise<RedisChatMessage[]> {
        const client = await redis.getClient();
        
        const messageIds = await client.zrevrange(
            this.ROOM_MESSAGES_KEY(roomId),
            offset,
            offset + limit - 1
        );

        const messages: RedisChatMessage[] = [];
        
        for (const messageId of messageIds) {
            const message = await redis.getJSON<RedisChatMessage>(`${this.MESSAGE_PREFIX}${messageId}`);
            if (message) {
                messages.push(message);
            }
        }

        return messages.reverse();
    }

    static async getRoomMessageCount(roomId: string): Promise<number> {
        const client = await redis.getClient();
        return await client.zcard(this.ROOM_MESSAGES_KEY(roomId));
    }

    static async deleteRoomMessages(roomId: string): Promise<void> {
        const client = await redis.getClient();
    
        const messageIds = await client.zrange(this.ROOM_MESSAGES_KEY(roomId), 0, -1);
        
        for (const messageId of messageIds) {
            await redis.del(`${this.MESSAGE_PREFIX}${messageId}`);
        }
        
        await redis.del(this.ROOM_MESSAGES_KEY(roomId));
    }
}