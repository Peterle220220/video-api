const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, RespondToAuthChallengeCommand, AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand, SetUserMFAPreferenceCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { jwtVerify } = require('jose');
const crypto = require('crypto');

const client = new CognitoIdentityProviderClient({ 
    region: process.env.AWS_REGION || 'ap-southeast-2' 
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_wgTgFFTuB';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '1o00oog3qb82t1qgvi62lfv9fa';
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || '1oftmplton69rcfvg4egrme6ia2vkheebc9u7u1im9l6gqdf48ql';

// Function to calculate SECRET_HASH
function calculateSecretHash(username) {
    if (!CLIENT_SECRET) {
        console.warn('COGNITO_CLIENT_SECRET not set - SECRET_HASH will not be calculated');
        return undefined; // No secret hash needed if no client secret
    }
    const message = username + CLIENT_ID;
    const secretHash = crypto.createHmac('sha256', CLIENT_SECRET).update(message).digest('base64');
    console.log(`Calculated SECRET_HASH for username: ${username}`);
    return secretHash;
}

// Sign up a new user
async function signUp({ username, password, email }) {
    const secretHash = calculateSecretHash(username);
    console.log(`SignUp - SECRET_HASH calculated: ${!!secretHash}`);
    
    const command = new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [
            { Name: 'email', Value: email }
        ],
        ...(secretHash && { SecretHash: secretHash })
    });

    return await client.send(command);
}

// Confirm sign up with verification code
async function confirmSignUp({ username, code }) {
    const secretHash = calculateSecretHash(username);
    console.log(`ConfirmSignUp - SECRET_HASH calculated: ${!!secretHash}`);
    
    const command = new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: username,
        ConfirmationCode: code,
        ...(secretHash && { SecretHash: secretHash })
    });

    return await client.send(command);
}

// Login user
async function login({ username, password }) {
    const secretHash = calculateSecretHash(username);
    console.log(`Login - SECRET_HASH calculated: ${!!secretHash}`);
    
    const authParameters = {
        USERNAME: username,
        PASSWORD: password,
        ...(secretHash && { SECRET_HASH: secretHash })
    };

    const command = new InitiateAuthCommand({
        ClientId: CLIENT_ID,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: authParameters
    });

    const result = await client.send(command);
    
    if (result.ChallengeName) {
        return {
            requiresMfa: true,
            challengeName: result.ChallengeName,
            session: result.Session,
            challengeParameters: result.ChallengeParameters
        };
    }

    return {
        idToken: result.AuthenticationResult?.IdToken,
        accessToken: result.AuthenticationResult?.AccessToken,
        refreshToken: result.AuthenticationResult?.RefreshToken
    };
}

// Respond to MFA challenge
async function respondToAuthChallenge({ challengeName, session, username, mfaCode }) {
    const secretHash = calculateSecretHash(username);
    console.log(`RespondToAuthChallenge - SECRET_HASH calculated: ${!!secretHash}`);
    
    const challengeResponses = {
        USERNAME: username,
        SOFTWARE_TOKEN_MFA_CODE: mfaCode,
        ...(secretHash && { SECRET_HASH: secretHash })
    };

    const command = new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: challengeName,
        Session: session,
        ChallengeResponses: challengeResponses
    });

    const result = await client.send(command);
    
    if (result.ChallengeName) {
        return {
            requiresMfa: true,
            challengeName: result.ChallengeName,
            session: result.Session,
            challengeParameters: result.ChallengeParameters
        };
    }

    return {
        idToken: result.AuthenticationResult?.IdToken,
        accessToken: result.AuthenticationResult?.AccessToken,
        refreshToken: result.AuthenticationResult?.RefreshToken
    };
}

// Associate software token for TOTP
async function associateSoftwareTokenWithAccessToken({ accessToken, username }) {
    const command = new AssociateSoftwareTokenCommand({
        AccessToken: accessToken
    });

    const result = await client.send(command);
    return {
        secretCode: result.SecretCode,
        session: result.Session
    };
}

// Verify TOTP and enable MFA
async function verifySoftwareTokenAndEnableMFA({ accessToken, code }) {
    const command = new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: code,
        FriendlyDeviceName: 'TOTP Device'
    });

    const result = await client.send(command);
    
    if (result.Status === 'SUCCESS') {
        // Enable MFA for the user
        await client.send(new SetUserMFAPreferenceCommand({
            AccessToken: accessToken,
            SoftwareTokenMfaSettings: {
                Enabled: true,
                PreferredMfa: true
            }
        }));
    }

    return result;
}

// Disable MFA
async function disableMFA({ accessToken }) {
    const command = new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: {
            Enabled: false,
            PreferredMfa: false
        }
    });

    return await client.send(command);
}

// Verify JWT token
async function verifyJwt(token) {
    try {
        // Get the JWKS URL for the user pool
        const jwksUrl = `https://cognito-idp.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;
        
        // For simplicity, we'll use a basic JWT verification
        // In production, you should use proper JWKS verification
        const { payload } = await jwtVerify(token, async (header, payload) => {
            // This is a simplified version - in production use proper JWKS
            return new TextEncoder().encode('your-secret-key');
        });

        return payload;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
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
