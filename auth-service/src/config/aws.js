const { fromEnv } = require('@aws-sdk/credential-provider-env');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
const S3_BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'cab432-a2-n12122882';
const QUT_USERNAME = process.env.QUT_USERNAME || 'n12122882@qut.edu.au';
const DDB_TABLE = process.env.DDB_TABLE || process.env.DDB_TABLE_MAIN || 'cab432-a2-n12122882-metadata';
const region = AWS_REGION;

// AWS Configuration
const awsConfig = {
    region,
    // Let AWS SDK use default credential chain (env vars, ~/.aws/credentials, IAM roles, etc.)
    maxAttempts: 3,
    retryMode: 'adaptive'
};

// DynamoDB Client
const dynamoClient = new DynamoDBClient(awsConfig);
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

// Cognito Client
const cognitoClient = new CognitoIdentityProviderClient(awsConfig);

module.exports = {
    dynamoClient,
    dynamoDocClient,
    cognitoClient,
    region,
    AWS_REGION,
    S3_BUCKET,
    QUT_USERNAME,
    DDB_TABLE
};
