const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { fromIni, fromEnv } = require('@aws-sdk/credential-providers');

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
const S3_BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'cab432-a2-n12122882';

// ElastiCache Memcached endpoint (host:port)
const MEMCACHED_ENDPOINT = process.env.MEMCACHED_ENDPOINT || 'video-api-n12122882.km2jzi.0001.apse2.cache.amazonaws.com:11211';

// QUT single-table support
const QUT_USERNAME = process.env.QUT_USERNAME || 'n12122882@qut.edu.au';
const DDB_TABLE = process.env.DDB_TABLE || process.env.DDB_TABLE_MAIN || 'cab432-a2-n12122882-metadata';

// Cognito configuration
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_wgTgFFTuB';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '1o00oog3qb82t1qgvi62lfv9fa';
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || '1oftmplton69rcfvg4egrme6ia2vkheebc9u7u1im9l6gqdf48ql';
const COGNITO_JWKS_URI = COGNITO_USER_POOL_ID
    ? `https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_wgTgFFTuB/.well-known/jwks.json`
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

// Configure AWS clients with credential providers
// Try environment variables first, then fall back to credential file
const credentialProvider = fromEnv();

const s3Client = new S3Client({ 
    region: AWS_REGION,
    credentials: credentialProvider
});
const ddbClient = new DynamoDBClient({ 
    region: AWS_REGION,
    credentials: credentialProvider
});

module.exports = {
    AWS_REGION,
    S3_BUCKET,
    MEMCACHED_ENDPOINT,
    QUT_USERNAME,
    DDB_TABLE,
    DDB_TABLE_VIDEOS,
    DDB_TABLE_JOBS,
    DDB_JOBS_GSI_VIDEO_ID,
    COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID,
    COGNITO_CLIENT_SECRET,
    COGNITO_JWKS_URI,
    s3Client,
    ddbClient,
    assertConfig
};


