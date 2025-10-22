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
        const userData = await serviceCommunication.auth.verifyToken(token);
        
        if (!userData.success) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Add user data to request
        req.user = userData.user;
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
            const userData = await serviceCommunication.auth.verifyToken(token);
            if (userData.success) {
                req.user = userData.user;
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
