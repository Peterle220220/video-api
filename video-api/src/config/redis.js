const redis = require('redis');

let redisClient = null;

async function initializeRedis() {
    try {
        redisClient = redis.createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
        });

        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        redisClient.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });

        await redisClient.connect();
        
        // Test connection
        await redisClient.ping();
        
        return redisClient;
    } catch (error) {
        console.error('❌ Redis connection failed:', error);
        throw error;
    }
}

function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis client not initialized');
    }
    return redisClient;
}

async function closeRedis() {
    if (redisClient) {
        await redisClient.quit();
        console.log('Redis connection closed');
    }
}

module.exports = {
    initializeRedis,
    getRedisClient,
    closeRedis
};
