const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDocClient, QUT_USERNAME, DDB_TABLE } = require('../config/aws');
// const { withCache, cacheDel } = // require('../cache/memcached') // Disabled; // Disabled for now

const docClient = dynamoDocClient;

// Helpers for single-table design
function makeVideoKey(videoId) {
    return `VIDEO#${videoId}`;
}
function makeJobKey(videoId, jobId) {
    return `JOB#${videoId}#${jobId}`;
}

// Videos (stored with PK: qut-username, SK: VIDEO#<video_id>)
async function putVideo(item) {
    const record = Object.assign({}, item, {
        'qut-username': QUT_USERNAME,
        sk: makeVideoKey(item.video_id)
    });
    await docClient.send(new PutCommand({ TableName: process.env.DYNAMODB_TABLE_NAME || 'cab432-a2-n12122882-metadata', Item: record }));
}

async function getVideo(videoId) {
    const res = await docClient.send(new GetCommand({
        TableName: DDB_TABLE,
        Key: { 'qut-username': process.env.QUT_USERNAME || 'n12122882@qut.edu.au', sk: makeVideoKey(videoId) }
    }));
    return res.Item || null;
}

// List all videos for current QUT user (SK begins with VIDEO#), sorted by updated_at desc
async function listVideos() {
    const items = [];
    let lastKey = undefined;
    do {
        const res = await docClient.send(new QueryCommand({
            TableName: DDB_TABLE,
            KeyConditionExpression: '#pk = :u AND begins_with(#sk, :videoPrefix)',
            ExpressionAttributeNames: { '#pk': 'qut-username', '#sk': 'sk' },
            ExpressionAttributeValues: { ':u': QUT_USERNAME, ':videoPrefix': 'VIDEO#' },
            ExclusiveStartKey: lastKey
        }));
        if (res.Items && res.Items.length) items.push(...res.Items);
        lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    items.sort((a, b) => {
        const au = a.updated_at || a.created_at || 0;
        const bu = b.updated_at || b.created_at || 0;
        return new Date(bu) - new Date(au);
    });
    return items;
}

async function updateVideoDescription(videoId, description) {
    const res = await docClient.send(new UpdateCommand({
        TableName: DDB_TABLE,
        Key: { 'qut-username': QUT_USERNAME, sk: makeVideoKey(videoId) },
        UpdateExpression: 'SET #d = :d, updated_at = :u',
        ExpressionAttributeNames: { '#d': 'description' },
        ExpressionAttributeValues: { ':d': description, ':u': new Date().toISOString() },
        ReturnValues: 'ALL_NEW'
    }));
    return res.Attributes || null;
}

// Jobs (stored with PK: qut-username, SK: JOB#<video_id>#<job_id>)
async function putJob(item) {
    const videoId = item.video_id;
    const jobId = item.job_id;
    const record = Object.assign({}, item, {
        'qut-username': QUT_USERNAME,
        sk: makeJobKey(videoId, jobId)
    });
    await docClient.send(new PutCommand({ TableName: process.env.DYNAMODB_TABLE_NAME || 'cab432-a2-n12122882-metadata', Item: record }));
    // Cache disabled - no action needed
}

// Note: We don't know videoId from jobId alone; query by PK and filter by job_id
async function getJob(jobId) {
    const cacheKey = `job:${QUT_USERNAME}:${jobId}`;
    // Cache disabled - direct call
    // Query by PK and sort key prefix in KeyCondition; filter by job_id
    const res = await docClient.send(new QueryCommand({
        TableName: DDB_TABLE,
        KeyConditionExpression: '#pk = :u AND begins_with(#sk, :jobPrefix)',
        ExpressionAttributeNames: { '#pk': 'qut-username', '#sk': 'sk', '#jid': 'job_id' },
        ExpressionAttributeValues: { ':u': QUT_USERNAME, ':jobPrefix': 'JOB#', ':jid': jobId },
        FilterExpression: '#jid = :jid',
        Limit: 1
    }));
    return (res.Items && res.Items[0]) || null;
}

async function updateJob(jobId, updates) {
    const existing = await getJob(jobId);
    if (!existing) return null;
    const keys = Object.keys(updates || {});
    if (keys.length === 0) return existing;
    const exprNames = {};
    const exprValues = {};
    const sets = [];
    for (const k of keys) {
        const nameKey = `#${k.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const valueKey = `:${k.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        exprNames[nameKey] = k;
        exprValues[valueKey] = updates[k];
        sets.push(`${nameKey} = ${valueKey}`);
    }
    const res = await docClient.send(new UpdateCommand({
        TableName: DDB_TABLE,
        Key: { 'qut-username': QUT_USERNAME, sk: existing.sk },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW'
    }));
    // Invalidate caches
    try {
        await cacheDel(`job:${QUT_USERNAME}:${jobId}`);
        // Active jobs list cache
        await cacheDel(`jobs:active:${QUT_USERNAME}`);
    } catch (_) {}
    return res.Attributes || null;
}

async function queryJobsByVideoId(videoId) {
    const res = await docClient.send(new QueryCommand({
        TableName: DDB_TABLE,
        KeyConditionExpression: '#pk = :u AND begins_with(#sk, :prefix)',
        ExpressionAttributeNames: { '#pk': 'qut-username', '#sk': 'sk' },
        ExpressionAttributeValues: { ':u': QUT_USERNAME, ':prefix': `JOB#${videoId}#` }
    }));
    return res.Items || [];
}

async function deleteJob(jobId) {
    const existing = await getJob(jobId);
    if (!existing) return;
    await docClient.send(new DeleteCommand({
        TableName: DDB_TABLE,
        Key: { 'qut-username': QUT_USERNAME, sk: existing.sk }
    }));
}

// List jobs currently in-flight (status = processing or pending)
async function listActiveJobs() {
    const cacheKey = `jobs:active:${QUT_USERNAME}`;
    // Cache disabled - direct call
    const res = await docClient.send(new QueryCommand({
        TableName: DDB_TABLE,
        KeyConditionExpression: '#pk = :u AND begins_with(#sk, :jobPrefix)',
        ExpressionAttributeNames: { '#pk': 'qut-username', '#sk': 'sk', '#status': 'status' },
        ExpressionAttributeValues: { ':u': QUT_USERNAME, ':jobPrefix': 'JOB#', ':processing': 'processing', ':pending': 'pending' },
        FilterExpression: '#status IN (:processing, :pending)'
    }));
    return res.Items || [];
}

// On startup, mark any in-flight jobs as failed (crash-safe, stateless)
async function failInFlightJobsOnStartup(message = 'Worker restarted') {
    const jobs = await listActiveJobs();
    for (const j of jobs) {
        try {
            await updateJob(j.job_id, {
                status: 'failed',
                error_message: message,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        } catch (_) { /* best-effort */ }
    }
    return jobs.length;
}

module.exports = {
    putVideo,
    getVideo,
    listVideos,
    updateVideoDescription,
    putJob,
    getJob,
    updateJob,
    queryJobsByVideoId,
    deleteJob,
    listActiveJobs,
    failInFlightJobsOnStartup
};


