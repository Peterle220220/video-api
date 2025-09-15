const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
const S3_BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || '';

// DynamoDB tables
const DDB_TABLE_VIDEOS = process.env.DDB_TABLE_VIDEOS || 'videos';
const DDB_TABLE_JOBS = process.env.DDB_TABLE_JOBS || 'jobs';
const DDB_JOBS_GSI_VIDEO_ID = process.env.DDB_JOBS_GSI_VIDEO_ID || 'video_id-index';

function assertConfig() {
    if (!S3_BUCKET) {
        console.warn('S3_BUCKET is not set. Set env S3_BUCKET to enable S3 integration.');
    }
}

const s3Client = new S3Client({ region: AWS_REGION });
const ddbClient = new DynamoDBClient({ region: AWS_REGION });

module.exports = {
    AWS_REGION,
    S3_BUCKET,
    DDB_TABLE_VIDEOS,
    DDB_TABLE_JOBS,
    DDB_JOBS_GSI_VIDEO_ID,
    s3Client,
    ddbClient,
    assertConfig
};


