const { verifyJwt } = require('../services/cognitoService');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const decoded = await verifyJwt(token);
        req.user = {
            id: decoded.sub,
            username: decoded['cognito:username'] || decoded.username || decoded.email,
            email: decoded.email,
            groups: decoded['cognito:groups'] || []
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

module.exports = { authenticateToken };
