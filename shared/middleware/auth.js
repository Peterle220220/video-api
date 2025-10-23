const { serviceCommunication } = require('../services/apiClient');

// Middleware to authenticate requests using Auth service
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        // Verify token with Auth service
        const response = await serviceCommunication.auth.verifyToken(token);

        if (!response || !response.success) {
            // Check if it's a token expired error
            if (response && response.error === 'Token expired') {
                return res.status(401).json({ error: 'Token expired' });
            }
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Add user data to request
        req.user = response.user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

// Middleware for optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const response = await serviceCommunication.auth.verifyToken(token);
            if (response && response.success) {
                req.user = response.user;
            }
        }
        
        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

module.exports = {
    authenticateToken,
    optionalAuth
};
