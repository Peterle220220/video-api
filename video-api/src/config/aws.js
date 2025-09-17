const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
const S3_BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'cab432-a2-n12122882';

// QUT single-table support
const QUT_USERNAME = process.env.QUT_USERNAME || 'n12122882@qut.edu.au';
const DDB_TABLE = process.env.DDB_TABLE || process.env.DDB_TABLE_MAIN || 'cab432-a2-n12122882-metadata';

// Cognito configuration
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';
const COGNITO_JWKS_URI = COGNITO_USER_POOL_ID
    ? `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`
    : '';

// DynamoDB tables
const DDB_TABLE_VIDEOS = process.env.DDB_TABLE_VIDEOS || 'cab432-a2-n12122882-videos';
const DDB_TABLE_JOBS = process.env.DDB_TABLE_JOBS || 'cab432-a2-n12122882-jobs';
const DDB_JOBS_GSI_VIDEO_ID = process.env.DDB_JOBS_GSI_VIDEO_ID || 'video_id-index';

function assertConfig() {
    if (!S3_BUCKET) {
        console.warn('S3_BUCKET is not set. Set env S3_BUCKET to enable S3 integration.');
    }
    if (!QUT_USERNAME) {
        console.warn('QUT_USERNAME is not set. Set env QUT_USERNAME to your QUT email.');
    }
}

const s3Client = new S3Client({ region: AWS_REGION });
const ddbClient = new DynamoDBClient({ region: AWS_REGION });

module.exports = {
    AWS_REGION,
    S3_BUCKET,
    QUT_USERNAME,
    DDB_TABLE,
    DDB_TABLE_VIDEOS,
    DDB_TABLE_JOBS,
    DDB_JOBS_GSI_VIDEO_ID,
    s3Client,
    ddbClient,
    assertConfig
};


