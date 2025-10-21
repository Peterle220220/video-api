const express = require('express');
const { signUp, confirmSignUp, login: cognitoLogin, respondToAuthChallenge, associateSoftwareTokenWithAccessToken, verifySoftwareTokenAndEnableMFA, disableMFA, verifyJwt } = require('../services/cognitoService');

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
        const result = await cognitoLogin({ username, password });
        if (result?.requiresMfa) {
            return res.status(200).json({
                success: true,
                mfaRequired: true,
                challengeName: result.challengeName,
                session: result.session,
                challengeParameters: result.challengeParameters || {},
                message: 'MFA required. Use /api/auth/challenge to respond.'
            });
        }
        if (!result || !result.idToken) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        return res.json({
            success: true,
            message: 'Login successful',
            user: { username },
            tokens: result
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(401).json({ error: error?.message || 'Login failed' });
    }
});

// Respond to MFA challenge
router.post('/challenge', async (req, res) => {
    try {
        const { username, session, challengeName, code } = req.body || {};
        if (!username || !session || !challengeName || !code) {
            return res.status(400).json({ error: 'username, session, challengeName, code are required' });
        }
        const result = await respondToAuthChallenge({ challengeName, session, username, mfaCode: code });
        if (result?.requiresMfa) {
            return res.status(400).json({ error: 'Additional challenge required', details: result });
        }
        if (!result?.idToken) return res.status(401).json({ error: 'Challenge failed' });
        return res.json({ success: true, message: 'MFA verified', tokens: result });
    } catch (error) {
        console.error('Challenge error:', error);
        return res.status(400).json({ error: error?.message || 'Challenge failed' });
    }
});

// Start TOTP enrollment (require signed-in accessToken)
router.post('/mfa/totp/associate', async (req, res) => {
    try {
        const { accessToken, username } = req.body || {};
        if (!accessToken) return res.status(401).json({ error: 'accessToken required' });
        const result = await associateSoftwareTokenWithAccessToken({ accessToken, username });
        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('Associate TOTP error:', error);
        return res.status(400).json({ error: error?.message || 'Associate TOTP failed' });
    }
});

// Verify TOTP and enable MFA
router.post('/mfa/totp/verify', async (req, res) => {
    try {
        const { accessToken, code } = req.body || {};
        if (!accessToken || !code) return res.status(400).json({ error: 'accessToken and code are required' });
        const result = await verifySoftwareTokenAndEnableMFA({ accessToken, code });
        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('Verify TOTP error:', error);
        return res.status(400).json({ error: error?.message || 'Verify TOTP failed' });
    }
});

// Disable MFA
router.post('/mfa/disable', async (req, res) => {
    try {
        const { accessToken } = req.body || {};
        if (!accessToken) return res.status(400).json({ error: 'accessToken is required' });
        const result = await disableMFA({ accessToken });
        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('Disable MFA error:', error);
        return res.status(400).json({ error: error?.message || 'Disable MFA failed' });
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
        message: 'Auth Service is working',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
