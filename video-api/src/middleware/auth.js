const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token (no DB lookup)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'dev-secret', async (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        // No database: trust payload issued by our server
        req.user = {
            id: decoded.userId || 'in-memory-user',
            username: decoded.username,
            email: decoded.email || `${decoded.username}@example.com`
        };
        next();
    });
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
