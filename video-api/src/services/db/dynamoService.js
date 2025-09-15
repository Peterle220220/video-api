const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { ddbClient, DDB_TABLE_VIDEOS, DDB_TABLE_JOBS, DDB_JOBS_GSI_VIDEO_ID } = require('../../config/aws');

const docClient = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false },
});

// Videos
async function putVideo(item) {
    await docClient.send(new PutCommand({ TableName: DDB_TABLE_VIDEOS, Item: item }));
}

async function getVideo(videoId) {
    const res = await docClient.send(new GetCommand({ TableName: DDB_TABLE_VIDEOS, Key: { video_id: videoId } }));
    return res.Item || null;
}

async function updateVideoDescription(videoId, description) {
    const res = await docClient.send(new UpdateCommand({
        TableName: DDB_TABLE_VIDEOS,
        Key: { video_id: videoId },
        UpdateExpression: 'SET #d = :d, updated_at = :u',
        ExpressionAttributeNames: { '#d': 'description' },
        ExpressionAttributeValues: { ':d': description, ':u': new Date().toISOString() },
        ReturnValues: 'ALL_NEW'
    }));
    return res.Attributes || null;
}

// Jobs
async function putJob(item) {
    await docClient.send(new PutCommand({ TableName: DDB_TABLE_JOBS, Item: item }));
}

async function getJob(jobId) {
    const res = await docClient.send(new GetCommand({ TableName: DDB_TABLE_JOBS, Key: { job_id: jobId } }));
    return res.Item || null;
}

async function updateJob(jobId, updates) {
    // Build dynamic update expression
    const keys = Object.keys(updates || {});
    if (keys.length === 0) return await getJob(jobId);
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
        TableName: DDB_TABLE_JOBS,
        Key: { job_id: jobId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW'
    }));
    return res.Attributes || null;
}

async function queryJobsByVideoId(videoId) {
    const res = await docClient.send(new QueryCommand({
        TableName: DDB_TABLE_JOBS,
        IndexName: DDB_JOBS_GSI_VIDEO_ID,
        KeyConditionExpression: 'video_id = :v',
        ExpressionAttributeValues: { ':v': videoId }
    }));
    return res.Items || [];
}

async function deleteJob(jobId) {
    await docClient.send(new DeleteCommand({ TableName: DDB_TABLE_JOBS, Key: { job_id: jobId } }));
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


