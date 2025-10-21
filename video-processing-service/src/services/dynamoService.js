const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ 
    region: process.env.AWS_REGION || 'ap-southeast-2' 
});
const docClient = DynamoDBDocumentClient.from(client);

const JOBS_TABLE = process.env.JOBS_TABLE_NAME || 'transcoding-jobs';
const VIDEOS_TABLE = process.env.VIDEOS_TABLE_NAME || 'videos';

// Job operations
async function putJob(job) {
    const command = new PutCommand({
        TableName: JOBS_TABLE,
        Item: job
    });
    return await docClient.send(command);
}

async function getJob(jobId) {
    const command = new GetCommand({
        TableName: JOBS_TABLE,
        Key: { job_id: jobId }
    });
    const result = await docClient.send(command);
    return result.Item;
}

async function updateJob(jobId, updates) {
    const command = new UpdateCommand({
        TableName: JOBS_TABLE,
        Key: { job_id: jobId },
        UpdateExpression: 'SET ' + Object.keys(updates).map(key => `${key} = :${key}`).join(', '),
        ExpressionAttributeValues: Object.fromEntries(
            Object.entries(updates).map(([key, value]) => [`:${key}`, value])
        ),
        ReturnValues: 'ALL_NEW'
    });
    const result = await docClient.send(command);
    return result.Attributes;
}

async function listActiveJobs() {
    const command = new ScanCommand({
        TableName: JOBS_TABLE,
        FilterExpression: 'status IN (:processing, :pending)',
        ExpressionAttributeValues: {
            ':processing': 'processing',
            ':pending': 'pending'
        }
    });
    const result = await docClient.send(command);
    return result.Items || [];
}

// Video operations
async function putVideo(video) {
    const command = new PutCommand({
        TableName: VIDEOS_TABLE,
        Item: video
    });
    return await docClient.send(command);
}

async function getVideo(videoId) {
    const command = new GetCommand({
        TableName: VIDEOS_TABLE,
        Key: { video_id: videoId }
    });
    const result = await docClient.send(command);
    return result.Item;
}

async function listVideos() {
    const command = new ScanCommand({
        TableName: VIDEOS_TABLE
    });
    const result = await docClient.send(command);
    return result.Items || [];
}

async function updateVideoDescription(videoId, description) {
    const command = new UpdateCommand({
        TableName: VIDEOS_TABLE,
        Key: { video_id: videoId },
        UpdateExpression: 'SET description = :description, updated_at = :updated_at',
        ExpressionAttributeValues: {
            ':description': description,
            ':updated_at': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
    });
    const result = await docClient.send(command);
    return result.Attributes;
}

async function failInFlightJobsOnStartup(reason) {
    const command = new ScanCommand({
        TableName: JOBS_TABLE,
        FilterExpression: 'status IN (:processing, :pending)',
        ExpressionAttributeValues: {
            ':processing': 'processing',
            ':pending': 'pending'
        }
    });
    const result = await docClient.send(command);
    const jobs = result.Items || [];
    
    let count = 0;
    for (const job of jobs) {
        try {
            await updateJob(job.job_id, {
                status: 'failed',
                error_message: reason,
                completed_at: new Date().toISOString()
            });
            count++;
        } catch (error) {
            console.error(`Failed to update job ${job.job_id}:`, error);
        }
    }
    
    return count;
}

module.exports = {
    putJob,
    getJob,
    updateJob,
    listActiveJobs,
    putVideo,
    getVideo,
    listVideos,
    updateVideoDescription,
    failInFlightJobsOnStartup
};
