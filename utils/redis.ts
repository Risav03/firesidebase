import {Redis} from "ioredis"

export const redis = new Redis(`${process.env.REDIS_URL}`, {
    maxRetriesPerRequest: null,
});

try { 
    redis.on("error", (err) => {
        console.error("Redis error:", err);
    });

    redis.on("connect", () => {
        console.log("Connected to Redis");
    });

} catch (error) {
    console.error("Error setting up Redis listener:", error);
}