const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { AWS_REGION, COGNITO_CLIENT_ID, COGNITO_JWKS_URI } = require('../../config/aws');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const client = new CognitoIdentityProviderClient({ region: AWS_REGION });

async function signUp({ username, password, email }) {
    if (!COGNITO_CLIENT_ID) throw new Error('COGNITO_CLIENT_ID not configured');
    const cmd = new SignUpCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [
            { Name: 'email', Value: email }
        ]
    });
    return await client.send(cmd);
}

async function confirmSignUp({ username, code }) {
    if (!COGNITO_CLIENT_ID) throw new Error('COGNITO_CLIENT_ID not configured');
    const cmd = new ConfirmSignUpCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: username,
        ConfirmationCode: code
    });
    return await client.send(cmd);
}

async function login({ username, password }) {
    if (!COGNITO_CLIENT_ID) throw new Error('COGNITO_CLIENT_ID not configured');
    const cmd = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password
        }
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


