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
        const rawGroups = payload['cognito:groups'];
        const groups = Array.isArray(rawGroups)
            ? rawGroups
            : (typeof rawGroups === 'string' && rawGroups.length ? [rawGroups] : []);
        req.user = {
            id: payload.sub || 'cognito-user',
            username: payload['cognito:username'] || payload.username || payload.email || 'user',
            email: payload.email,
            groups,
            isAdmin: groups.some(g => String(g).toLowerCase() === 'admin')
        };
        return next();
    } catch (e) {
        // Check if it's a JWT expired error
        if (e.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
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
