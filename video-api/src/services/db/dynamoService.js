const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { ddbClient, DDB_TABLE, QUT_USERNAME } = require('../../config/aws');

const docClient = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false },
});

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
    await docClient.send(new PutCommand({ TableName: DDB_TABLE, Item: record }));
}

async function getVideo(videoId) {
    const res = await docClient.send(new GetCommand({
        TableName: DDB_TABLE,
        Key: { 'qut-username': QUT_USERNAME, sk: makeVideoKey(videoId) }
    }));
    return res.Item || null;
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
    await docClient.send(new PutCommand({ TableName: DDB_TABLE, Item: record }));
}

// Note: We don't know videoId from jobId alone; query by PK and filter by job_id
async function getJob(jobId) {
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

module.exports = {
    putVideo,
    getVideo,
    updateVideoDescription,
    putJob,
    getJob,
    updateJob,
    queryJobsByVideoId,
    deleteJob
};


