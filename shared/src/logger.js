const os = require('os');

function toSafeString(value) {
    try {
        if (value === undefined) return undefined;
        if (typeof value === 'string') return value;
        return JSON.stringify(value);
    } catch (_) {
        return String(value);
    }
}

function createLogger({ serviceName = process.env.SERVICE_NAME || 'unknown-service' } = {}) {
    function base(fields = {}) {
        return Object.assign({
            service: serviceName,
            hostname: os.hostname(),
            timestamp: new Date().toISOString(),
        }, fields);
    }

    return {
        debug(ctx, msg, extra) {
            const line = base(Object.assign({}, ctx, { level: 'debug', message: msg }, extra || {}));
            console.log(toSafeString(line));
        },
        info(ctx, msg, extra) {
            const line = base(Object.assign({}, ctx, { level: 'info', message: msg }, extra || {}));
            console.log(toSafeString(line));
        },
        warn(ctx, msg, extra) {
            const line = base(Object.assign({}, ctx, { level: 'warn', message: msg }, extra || {}));
            console.warn(toSafeString(line));
        },
        error(ctx, msg, extra) {
            const line = base(Object.assign({}, ctx, { level: 'error', message: msg }, extra || {}));
            console.error(toSafeString(line));
        },
    };
}

const logger = createLogger();

module.exports = {
    createLogger,
    logger,
};


