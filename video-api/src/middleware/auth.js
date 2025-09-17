const jwt = require('jsonwebtoken');
const { verifyJwt } = require('../services/external/cognitoService');

// Middleware to authenticate JWT token (no DB lookup)
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const payload = await verifyJwt(token);
        req.user = {
            id: payload.sub || 'cognito-user',
            username: payload['cognito:username'] || payload.username || payload.email || 'user',
            email: payload.email,
            groups: payload['cognito:groups']
        };
        return next();
    } catch (e) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Generate JWT token with username/role (no DB)
const generateToken = ({ userId = 'in-memory-user', username, email }) => {
    return jwt.sign(
        { userId, username, email },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

module.exports = {
    authenticateToken,
    generateToken
};
