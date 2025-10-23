const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Cognito configuration
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_wgTgFFTuB';
const COGNITO_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '1o00oog3qb82t1qgvi62lfv9fa';

// JWKS client for token verification
const client = jwksClient({
    jwksUri: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000, // 10 minutes
});

// Get signing key for JWT verification
function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) {
            console.error('Error getting signing key:', err);
            return callback(err);
        }
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
}

// Verify JWT token
async function verifyJwt(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            getKey,
            {
                algorithms: ['RS256'],
                issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
                audience: COGNITO_CLIENT_ID
            },
            (err, decoded) => {
                if (err) {
                    console.error('JWT verification error:', err);
                    return reject(err);
                }
                resolve(decoded);
            }
        );
    });
}

// Verify token without Cognito (fallback for development)
async function verifyJwtFallback(token) {
    try {
        // Simple JWT verification for development
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        return decoded;
    } catch (error) {
        throw new Error('Invalid token');
    }
}

module.exports = {
    verifyJwt: COGNITO_USER_POOL_ID ? verifyJwt : verifyJwtFallback,
    verifyJwtFallback
};
