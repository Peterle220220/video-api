const memjs = require('memjs');
const { MEMCACHED_ENDPOINT } = require('../../config/aws');

let client = null;

function getClient() {
    if (client) return client;
    // MEMCACHED_ENDPOINT in form host:port
    const server = MEMCACHED_ENDPOINT;
    client = memjs.Client.create(server, {
        // Safe defaults; adjust as needed
        failover: true,
        keepAlive: true,
        timeout: 1.0,
    });
    return client;
}

async function cacheGet(key) {
    try {
        const c = getClient();
        const { value } = await c.get(key);
        if (!value) return null;
        try { return JSON.parse(value.toString('utf-8')); } catch (_) { return null; }
    } catch (_) {
        return null; // fail-open on cache errors
    }
}

async function cacheSet(key, value, ttlSeconds) {
    try {
        const c = getClient();
        const bytes = Buffer.from(JSON.stringify(value));
        await c.set(key, bytes, { expires: Math.max(1, Math.floor(ttlSeconds || 1)) });
    } catch (_) {
        // ignore
    }
}

async function cacheDel(key) {
    try {
        const c = getClient();
        await c.delete(key);
    } catch (_) {
        // ignore
    }
}

async function withCache(key, ttlSeconds, loader) {
    const hit = await cacheGet(key);
    if (hit !== null && hit !== undefined) return hit;
    const data = await loader();
    if (data !== undefined) await cacheSet(key, data, ttlSeconds);
    return data;
}

module.exports = {
    cacheGet,
    cacheSet,
    cacheDel,
    withCache,
};


