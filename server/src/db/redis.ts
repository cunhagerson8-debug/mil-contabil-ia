import { createClient } from "redis";

export const redisClient = createClient({
 url: process.env.REDIS_URL || "redis://127.0.0.1:6380",
});

redisClient.on("error", (error) => {
 console.error("[redis] Erro de conexao:", error);
});

export async function connectRedis(): Promise<void> {
 if (!redisClient.isOpen) {
 await redisClient.connect();
 }
}
