const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

function flattenObjectToEnvPairs(object, parentKey = '') {
    const entries = {};
    if (!object || typeof object !== 'object') return entries;
    for (const [key, value] of Object.entries(object)) {
        const composed = parentKey ? `${parentKey}_${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(entries, flattenObjectToEnvPairs(value, composed));
        } else {
            entries[composed] = value;
        }
    }
    return entries;
}

async function loadSecretsToEnv({
    secretIds,
    region,
    prefix,
    overwrite = false,
    toUpperCase = true,
    failSilently = true,
} = {}) {
    try {
        const resolvedRegion = region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
        const client = new SecretsManagerClient({ region: resolvedRegion });

        let ids = secretIds;
        if (!ids) {
            const single = process.env.AWS_SECRETS_ID || process.env.SECRETS_MANAGER_SECRET_ID || '';
            const multi = process.env.AWS_SECRETS_IDS || '';
            ids = multi ? multi.split(',').map(s => s.trim()).filter(Boolean) : (single ? [single] : []);
        }
        if (!ids || ids.length === 0) return { loaded: 0 };

        let loadedCount = 0;
        for (const id of ids) {
            try {
                const res = await client.send(new GetSecretValueCommand({ SecretId: id }));
                let payload = res.SecretString;
                if (!payload && res.SecretBinary) {
                    payload = Buffer.from(res.SecretBinary, 'base64').toString('utf-8');
                }
                if (!payload) continue;

                let data = {};
                try {
                    data = JSON.parse(payload);
                } catch (_) {
                    // If not JSON, attempt simple KEY=VALUE lines
                    const obj = {};
                    String(payload).split(/\r?\n/).forEach(line => {
                        const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
                        if (m) obj[m[1]] = m[2];
                    });
                    data = obj;
                }

                const flat = flattenObjectToEnvPairs(data);
                for (let [k, v] of Object.entries(flat)) {
                    if (prefix) k = `${prefix}${k}`;
                    const envKey = toUpperCase ? String(k).replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase() : k;
                    if (process.env[envKey] == null || overwrite) {
                        process.env[envKey] = v != null ? String(v) : '';
                    }
                }
                loadedCount += 1;
            } catch (e) {
                if (!failSilently) throw e;
                console.warn(`Failed to load secret '${id}':`, e?.message || e);
            }
        }
        return { loaded: loadedCount };
    } catch (e) {
        if (!failSilently) throw e;
        console.warn('Secrets loading encountered an error:', e?.message || e);
        return { loaded: 0 };
    }
}

module.exports = {
    loadSecretsToEnv,
};



