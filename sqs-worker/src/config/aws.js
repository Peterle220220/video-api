const { fromEnv } = require('@aws-sdk/credential-provider-env');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { S3Client } = require('@aws-sdk/client-s3');
const { SQSClient } = require('@aws-sdk/client-sqs');

const region = process.env.AWS_REGION || 'ap-southeast-2';

// AWS Configuration
const awsConfig = {
    region,
    // credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY 
    //     ? {
    //         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    //         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    //       }
    //     : fromEnv(),
    maxAttempts: 3,
    retryMode: 'adaptive'
};

// DynamoDB Client
const dynamoClient = new DynamoDBClient(awsConfig);
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

// S3 Client
const s3Client = new S3Client(awsConfig);

// SQS Client
const sqsClient = new SQSClient(awsConfig);

module.exports = {
    dynamoClient,
    dynamoDocClient,
    s3Client,
    sqsClient,
    region
};
