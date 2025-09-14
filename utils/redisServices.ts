import mongoose, { Mongoose } from 'mongoose';
import { redis } from './redis';
import { IUser } from './schemas/User';

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
    dbId:mongoose.Types.ObjectId;
    username: string;
    displayName: string;
    pfp_url: string;
    wallet: string;
    role: 'host' | 'co-host' | 'speaker' | 'listener';
    status: 'active' | 'inactive';
    joinedAt: string;
}

export class RedisRoomService {
    // New structure: participants:roomId:role -> Set of user data
    private static PARTICIPANTS_PREFIX = 'participants:';

    // Get a specific participant's info and role
    static async getParticipant(roomId: string, userFid: string): Promise<{ participant: RoomParticipant; role: string } | null> {
        const roles = ['host', 'co-host', 'speaker', 'listener'];
        
        for (const role of roles) {
            const roleKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${role}`;
            const client = await redis.getClient();
            const participants = await client.smembers(roleKey);
            
            for (const participantData of participants) {
                try {
                    const participant = JSON.parse(participantData) as RoomParticipant;
                    if (participant.userId === userFid) {
                        return { participant, role };
                    }
                } catch (error) {
                    console.error('Error parsing participant data:', error);
                }
            }
        }
        
        return null;
    }

    // Add a participant to a specific role
    static async addParticipant(roomId: string, user: IUser, role: 'host' | 'co-host' | 'speaker' | 'listener'): Promise<void> {
        // First, remove user from any existing role
        await this.removeParticipant(roomId, user.fid);
        
        const participant: RoomParticipant = {
            userId: user.fid,
            dbId: user._id,
            username: user.username,
            displayName: user.displayName,
            pfp_url: user.pfp_url,
            wallet: user.wallet || '',
            role: role,
            status: 'active',
            joinedAt: new Date().toISOString()
        };

        const roleKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${role}`;
        const client = await redis.getClient();
        await client.sadd(roleKey, JSON.stringify(participant));
        // await redis.expire(roleKey, 86400); // 24 hours
    }

    // Update a participant's role (move them between role sets)
    static async updateParticipantRole(roomId: string, userFid: string, newRole: 'host' | 'co-host' | 'speaker' | 'listener'): Promise<void> {
        const currentData = await this.getParticipant(roomId, userFid);
        
        if (currentData) {
            // Remove from current role
            await this.removeParticipant(roomId, userFid);
            
            // Update role in participant data and add to new role
            const updatedParticipant = { ...currentData.participant, role: newRole };
            const roleKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${newRole}`;
            const client = await redis.getClient();
            await client.sadd(roleKey, JSON.stringify(updatedParticipant));
            // await redis.expire(roleKey, 86400);
        }
    }

    // Update a participant's status (active/inactive) without changing their role
    static async updateParticipantStatus(roomId: string, userFid: string, newStatus: 'active' | 'inactive'): Promise<void> {
        const currentData = await this.getParticipant(roomId, userFid);
        
        if (currentData) {
            // Update status in participant data
            const updatedParticipant = { ...currentData.participant, status: newStatus };
            
            // Remove old entry and add updated entry to the same role set
            const roleKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${currentData.role}`;
            const client = await redis.getClient();
            
            // Remove old entry
            await client.srem(roleKey, JSON.stringify(currentData.participant));
            
            // Add updated entry
            await client.sadd(roleKey, JSON.stringify(updatedParticipant));
            // await redis.expire(roleKey, 86400);
        }
    }

    // Remove a participant from all roles
    static async removeParticipant(roomId: string, userFid: string): Promise<void> {
        const roles = ['host', 'co-host', 'speaker', 'listener'];
        const client = await redis.getClient();
        
        for (const role of roles) {
            const roleKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${role}`;
            const participants = await client.smembers(roleKey);
            
            for (const participantData of participants) {
                try {
                    const participant = JSON.parse(participantData) as RoomParticipant;
                    if (participant.userId === userFid) {
                        await client.srem(roleKey, participantData);
                        break;
                    }
                } catch (error) {
                    console.error('Error parsing participant data:', error);
                }
            }
        }
    }

    // Get all participants in a room organized by role
    static async getRoomParticipantsByRole(roomId: string): Promise<Record<string, RoomParticipant[]>> {
        const roles = ['host', 'co-host', 'speaker', 'listener'];
        const result: Record<string, RoomParticipant[]> = {};
        const client = await redis.getClient();
        
        for (const role of roles) {
            const roleKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${role}`;
            const participants = await client.smembers(roleKey);
            
            result[role] = [];
            for (const participantData of participants) {
                try {
                    const participant = JSON.parse(participantData) as RoomParticipant;
                    result[role].push(participant);
                } catch (error) {
                    console.error('Error parsing participant data:', error);
                }
            }
        }
        
        return result;
    }

    // Get all participants in a room (flat list)
    static async getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
        const participantsByRole = await this.getRoomParticipantsByRole(roomId);
        const allParticipants: RoomParticipant[] = [];
        
        Object.values(participantsByRole).forEach(roleParticipants => {
            allParticipants.push(...roleParticipants);
        });
        
        return allParticipants;
    }

    // Get participants for a specific role
    static async getParticipantsByRole(roomId: string, role: 'host' | 'co-host' | 'speaker' | 'listener'): Promise<RoomParticipant[]> {
        const roleKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${role}`;
        const client = await redis.getClient();
        const participants = await client.smembers(roleKey);
        
        const result: RoomParticipant[] = [];
        for (const participantData of participants) {
            try {
                const participant = JSON.parse(participantData) as RoomParticipant;
                result.push(participant);
            } catch (error) {
                console.error('Error parsing participant data:', error);
            }
        }
        
        return result;
    }

    // Get only active participants for a specific role
    static async getActiveParticipantsByRole(roomId: string, role: 'host' | 'co-host' | 'speaker' | 'listener'): Promise<RoomParticipant[]> {
        const allParticipants = await this.getParticipantsByRole(roomId, role);
        return allParticipants.filter(p => p.status === 'active');
    }

    // Get all active participants in a room organized by role
    static async getActiveRoomParticipantsByRole(roomId: string): Promise<Record<string, RoomParticipant[]>> {
        const roles = ['host', 'co-host', 'speaker', 'listener'];
        const result: Record<string, RoomParticipant[]> = {};
        
        for (const role of roles) {
            result[role] = await this.getActiveParticipantsByRole(roomId, role as any);
        }
        
        return result;
    }

    // Get all active participants in a room (flat list)
    static async getActiveRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
        const participantsByRole = await this.getActiveRoomParticipantsByRole(roomId);
        const allParticipants: RoomParticipant[] = [];
        
        Object.values(participantsByRole).forEach(roleParticipants => {
            allParticipants.push(...roleParticipants);
        });
        
        return allParticipants;
    }

    // Clean up all participants for a room
    static async deleteRoomParticipants(roomId: string): Promise<void> {
        const roles = ['host', 'co-host', 'speaker', 'listener'];
        
        for (const role of roles) {
            const roleKey = `${this.PARTICIPANTS_PREFIX}${roomId}:${role}`;
            await redis.del(roleKey);
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
        
        // await redis.expire(this.ROOM_MESSAGES_KEY(roomId), 86400);

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