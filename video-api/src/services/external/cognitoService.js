const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { AWS_REGION, COGNITO_CLIENT_ID, COGNITO_JWKS_URI, COGNITO_CLIENT_SECRET } = require('../../config/aws');
const crypto = require('crypto');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const client = new CognitoIdentityProviderClient({ region: AWS_REGION });

function computeSecretHash(username) {
    if (!COGNITO_CLIENT_SECRET) return undefined;
    const message = `${username}${COGNITO_CLIENT_ID}`;
    return crypto.createHmac('sha256', COGNITO_CLIENT_SECRET).update(message).digest('base64');
}

async function signUp({ username, password, email }) {
    if (!COGNITO_CLIENT_ID) throw new Error('COGNITO_CLIENT_ID not configured');
    const params = {
        ClientId: COGNITO_CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [
            { Name: 'email', Value: email }
        ]
    };
    const secretHash = computeSecretHash(username);
    if (secretHash) params.SecretHash = secretHash;
    const cmd = new SignUpCommand(params);
    return await client.send(cmd);
}

async function confirmSignUp({ username, code }) {
    if (!COGNITO_CLIENT_ID) throw new Error('COGNITO_CLIENT_ID not configured');
    const params = {
        ClientId: COGNITO_CLIENT_ID,
        Username: username,
        ConfirmationCode: code
    };
    const secretHash = computeSecretHash(username);
    if (secretHash) params.SecretHash = secretHash;
    const cmd = new ConfirmSignUpCommand(params);
    return await client.send(cmd);
}

async function login({ username, password }) {
    if (!COGNITO_CLIENT_ID) throw new Error('COGNITO_CLIENT_ID not configured');
    const authParams = {
        USERNAME: username,
        PASSWORD: password
    };
    const secretHash = computeSecretHash(username);
    if (secretHash) authParams.SECRET_HASH = secretHash;
    const cmd = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: authParams
    });
    const res = await client.send(cmd);
    return {
        idToken: res?.AuthenticationResult?.IdToken,
        accessToken: res?.AuthenticationResult?.AccessToken,
        refreshToken: res?.AuthenticationResult?.RefreshToken,
        expiresIn: res?.AuthenticationResult?.ExpiresIn
    };
}

async function verifyJwt(token) {
    if (!COGNITO_JWKS_URI) throw new Error('COGNITO_JWKS_URI not configured');
    const JWKS = createRemoteJWKSet(new URL(COGNITO_JWKS_URI));
    const { payload } = await jwtVerify(token, JWKS);
    return payload;
}

module.exports = {
    signUp,
    confirmSignUp,
    login,
    verifyJwt
};


