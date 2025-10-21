const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, RespondToAuthChallengeCommand, AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand, SetUserMFAPreferenceCommand } = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const client = new CognitoIdentityProviderClient({ 
    region: process.env.AWS_REGION || 'ap-southeast-2' 
});

const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const COGNITO_JWKS_URI = process.env.COGNITO_JWKS_URI;
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;

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
    if (res?.ChallengeName) {
        return {
            challengeName: res.ChallengeName,
            session: res.Session,
            challengeParameters: res.ChallengeParameters || {},
            requiresMfa: true
        };
    }
    return {
        idToken: res?.AuthenticationResult?.IdToken,
        accessToken: res?.AuthenticationResult?.AccessToken,
        refreshToken: res?.AuthenticationResult?.RefreshToken,
        expiresIn: res?.AuthenticationResult?.ExpiresIn,
        requiresMfa: false
    };
}

async function respondToAuthChallenge({ challengeName, session, username, mfaCode }) {
    if (!COGNITO_CLIENT_ID) throw new Error('COGNITO_CLIENT_ID not configured');
    if (!challengeName || !session || !username) {
        throw new Error('challengeName, session, username are required');
    }
    const challengeResponses = { USERNAME: username };
    const secretHash = computeSecretHash(username);
    if (secretHash) challengeResponses.SECRET_HASH = secretHash;
    if (challengeName === 'SOFTWARE_TOKEN_MFA') {
        challengeResponses.SOFTWARE_TOKEN_MFA_CODE = mfaCode;
    } else if (challengeName === 'SMS_MFA') {
        challengeResponses.SMS_MFA_CODE = mfaCode;
    }
    const cmd = new RespondToAuthChallengeCommand({
        ChallengeName: challengeName,
        ClientId: COGNITO_CLIENT_ID,
        Session: session,
        ChallengeResponses: challengeResponses
    });
    const res = await client.send(cmd);
    if (res?.ChallengeName) {
        return {
            challengeName: res.ChallengeName,
            session: res.Session,
            challengeParameters: res.ChallengeParameters || {},
            requiresMfa: true
        };
    }
    return {
        idToken: res?.AuthenticationResult?.IdToken,
        accessToken: res?.AuthenticationResult?.AccessToken,
        refreshToken: res?.AuthenticationResult?.RefreshToken,
        expiresIn: res?.AuthenticationResult?.ExpiresIn,
        requiresMfa: false
    };
}

async function associateSoftwareTokenWithAccessToken({ accessToken, username, issuer = 'VideoAPI' }) {
    if (!accessToken) throw new Error('accessToken is required');
    const cmd = new AssociateSoftwareTokenCommand({ AccessToken: accessToken });
    const res = await client.send(cmd);
    const secretCode = res?.SecretCode;
    if (!secretCode) throw new Error('Failed to get TOTP secret');
    const label = encodeURIComponent(`${issuer}:${username || 'user'}`);
    const otpauthUri = `otpauth://totp/${label}?secret=${secretCode}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    return { secretCode, otpauthUri };
}

async function verifySoftwareTokenAndEnableMFA({ accessToken, code }) {
    if (!accessToken || !code) throw new Error('accessToken and code are required');
    const verifyCmd = new VerifySoftwareTokenCommand({ AccessToken: accessToken, UserCode: code });
    const verifyRes = await client.send(verifyCmd);
    if (verifyRes?.Status !== 'SUCCESS') {
        throw new Error('Invalid TOTP code');
    }
    const setPrefCmd = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true }
    });
    await client.send(setPrefCmd);
    return { enabled: true };
}

async function disableMFA({ accessToken }) {
    if (!accessToken) throw new Error('accessToken is required');
    const setPrefCmd = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false }
    });
    await client.send(setPrefCmd);
    return { enabled: false };
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
    respondToAuthChallenge,
    associateSoftwareTokenWithAccessToken,
    verifySoftwareTokenAndEnableMFA,
    disableMFA,
    verifyJwt
};
