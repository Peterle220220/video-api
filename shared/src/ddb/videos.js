const { PutCommand, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ddbDocClient } = require('../aws/clients');

const DDB_TABLE_VIDEOS = process.env.DYNAMO_TABLE_VIDEOS || process.env.DDB_TABLE_VIDEOS || 'videos';
const GSI_OWNER_CREATED = process.env.DDB_VIDEOS_GSI_OWNER_CREATED || 'ownerId-createdAt';

async function putVideo({
    videoId,
    ownerId,
    status = 'queued',
    inputKey,
    outputs = [],
    transcriptText = null,
    errorReason = null,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
}) {
    const item = {
        videoId,
        ownerId,
        status,
        inputKey,
        outputs,
        transcriptText,
        errorReason,
        createdAt,
        updatedAt,
    };
    await ddbDocClient.send(new PutCommand({ TableName: DDB_TABLE_VIDEOS, Item: item }));
    return item;
}

async function getVideo(videoId) {
    const res = await ddbDocClient.send(new GetCommand({ TableName: DDB_TABLE_VIDEOS, Key: { videoId } }));
    return res.Item || null;
}

async function updateVideo(videoId, updates) {
    const keys = Object.keys(updates || {});
    if (!keys.length) return await getVideo(videoId);
    const exprNames = {};
    const exprValues = { ':updatedAt': new Date().toISOString() };
    const sets = ['updatedAt = :updatedAt'];
    for (const key of keys) {
        const nk = `#${key.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const vk = `:${key.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        exprNames[nk] = key;
        exprValues[vk] = updates[key];
        sets.push(`${nk} = ${vk}`);
    }
    const res = await ddbDocClient.send(new UpdateCommand({
        TableName: DDB_TABLE_VIDEOS,
        Key: { videoId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW',
    }));
    return res.Attributes || null;
}

async function appendOutput(videoId, output) {
    const res = await ddbDocClient.send(new UpdateCommand({
        TableName: DDB_TABLE_VIDEOS,
        Key: { videoId },
        UpdateExpression: 'SET outputs = list_append(if_not_exists(outputs, :empty), :o), updatedAt = :u',
        ExpressionAttributeValues: {
            ':o': [output],
            ':empty': [],
            ':u': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
    }));
    return res.Attributes || null;
}

async function markFailed(videoId, reason) {
    return await updateVideo(videoId, { status: 'failed', errorReason: reason });
}

async function queryByOwner(ownerId, { limit = 50, exclusiveStartKey } = {}) {
    const res = await ddbDocClient.send(new QueryCommand({
        TableName: DDB_TABLE_VIDEOS,
        IndexName: GSI_OWNER_CREATED,
        KeyConditionExpression: '#o = :o',
        ExpressionAttributeNames: { '#o': 'ownerId' },
        ExpressionAttributeValues: { ':o': ownerId },
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: false,
    }));
    return { items: res.Items || [], lastKey: res.LastEvaluatedKey };
}

module.exports = {
    DDB_TABLE_VIDEOS,
    putVideo,
    getVideo,
    updateVideo,
    appendOutput,
    markFailed,
    queryByOwner,
};


