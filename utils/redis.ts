import Redis from 'ioredis';

class RedisManager {
    private static instance: RedisManager;
    private client: Redis | null = null;
    private isConnecting = false;

    private constructor() { }

    public static getInstance(): RedisManager {
        if (!RedisManager.instance) {
            RedisManager.instance = new RedisManager();
        }
        return RedisManager.instance;
    }

    public async getClient(): Promise<Redis> {
        if (this.client && this.client.status === 'ready') {
            return this.client;
        }

        if (this.isConnecting) {
            while (this.isConnecting) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (this.client && this.client.status === 'ready') {
                return this.client;
            }
        }

        await this.connect();
        return this.client!;
    }

    private async connect(): Promise<void> {
        if (this.isConnecting || (this.client && this.client.status === 'ready')) {
            return;
        }

        this.isConnecting = true;

        try {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

            this.client = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                reconnectOnError: (err) => {
                    const targetError = 'READONLY';
                    return err.message.includes(targetError);
                },
                
            });

            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
            });

            this.client.on('connect', () => {
                console.log('Redis client connected');
            });

            this.client.on('ready', () => {
                console.log('Redis client ready');
            });

            this.client.on('close', () => {
                console.log('Redis client disconnected');
            });

            this.client.on('reconnecting', () => {
                console.log('Redis client reconnecting...');
            });

            await this.client.connect();
            console.log('Redis connection established successfully');
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            this.client = null;
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    public async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
        }
    }

    public async set(key: string, value: string, expireInSeconds?: number): Promise<void> {
        const client = await this.getClient();
        if (expireInSeconds) {
            await client.setex(key, expireInSeconds, value);
        } else {
            await client.set(key, value);
        }
    }

    public async get(key: string): Promise<string | null> {
        const client = await this.getClient();
        return await client.get(key);
    }

    public async setJSON(key: string, value: any, expireInSeconds?: number): Promise<void> {
        const client = await this.getClient();
        const jsonString = JSON.stringify(value);
        if (expireInSeconds) {
            await client.setex(key, expireInSeconds, jsonString);
        } else {
            await client.set(key, jsonString);
        }
    }

    public async getJSON<T>(key: string): Promise<T | null> {
        const client = await this.getClient();
        const value = await client.get(key);

        if (!value) return null;
        try {
            return JSON.parse(value) as T;
        } catch (error) {
            console.error('Failed to parse JSON from Redis:', error);
            return null;
        }
    }

    public async del(key: string): Promise<void> {
        const client = await this.getClient();
        await client.del(key);
    }

    public async exists(key: string): Promise<boolean> {
        const client = await this.getClient();
        const result = await client.exists(key);
        return result === 1;
    }

    public async expire(key: string, seconds: number): Promise<void> {
        const client = await this.getClient();
        await client.expire(key, seconds);
    }

    public async keys(pattern: string): Promise<string[]> {
        const client = await this.getClient();
        return await client.keys(pattern);
    }
}

export const redis = RedisManager.getInstance();

export { RedisManager };

export type { Redis };