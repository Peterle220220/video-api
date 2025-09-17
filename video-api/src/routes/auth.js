const express = require('express');
const { signUp, confirmSignUp, login: cognitoLogin, verifyJwt } = require('../services/external/cognitoService');

const router = express.Router();

// Sign up via Cognito (optional for demo; can be disabled by env)
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body || {};
        if (!username || !password || !email) {
            return res.status(400).json({ error: 'username, password, email are required' });
        }
        const result = await signUp({ username, password, email });
        return res.json({
            success: true,
            message: 'Sign up initiated',
            userConfirmed: !!result?.UserConfirmed,
            codeDelivery: result?.CodeDeliveryDetails || null
        });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(400).json({ error: err?.message || 'Register failed' });
    }
});

// Login via Cognito
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const tokens = await cognitoLogin({ username, password });
        if (!tokens || !tokens.idToken) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        return res.json({
            success: true,
            message: 'Login successful',
            user: { username },
            tokens
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(401).json({ error: error?.message || 'Login failed' });
    }
});

// Confirm sign up via Cognito
router.post('/confirm', async (req, res) => {
    try {
        const { username, code } = req.body || {};
        if (!username || !code) {
            return res.status(400).json({ error: 'username and code are required' });
        }
        await confirmSignUp({ username, code });
        return res.json({ success: true, message: 'Account confirmed' });
    } catch (error) {
        console.error('Confirm sign up error:', error);
        return res.status(400).json({ error: error?.message || 'Confirmation failed' });
    }
});

// Get current user profile using Cognito JWT
router.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        const decoded = await verifyJwt(token);
        return res.json({
            success: true,
            user: {
                id: decoded.sub,
                username: decoded['cognito:username'] || decoded.username || decoded.email,
                email: decoded.email,
                groups: decoded['cognito:groups'] || []
            }
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
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
