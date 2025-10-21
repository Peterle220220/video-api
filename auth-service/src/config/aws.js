const { fromEnv } = require('@aws-sdk/credential-provider-env');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

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

// Cognito Client
const cognitoClient = new CognitoIdentityProviderClient(awsConfig);

module.exports = {
    dynamoClient,
    dynamoDocClient,
    cognitoClient,
    region
};
