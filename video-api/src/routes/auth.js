const express = require('express');
const { generateToken } = require('../middleware/auth');
const accounts = require('../config/accounts');

const router = express.Router();

// Registration disabled (no database)
router.post('/register', async (req, res) => {
    return res.status(400).json({ error: 'Registration is disabled in this demo' });
});

// Login with hard-coded username and password (no database)
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const found = accounts.find(acc => acc.username === username && acc.password === password);
        if (!found) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = generateToken({
            userId: found.id,
            username: found.username,
            email: found.email
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: found.id,
                username: found.username,
                email: found.email,
            },
            token: token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user profile (from token only)
router.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

        res.json({
            success: true,
            user: {
                id: decoded.userId,
                username: decoded.username,
                email: decoded.email,
                role: decoded.role
            }
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Test endpoint (no authentication required)
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Auth API is working',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
