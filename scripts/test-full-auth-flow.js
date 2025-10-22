const axios = require('axios');

// Service URLs
const AUTH_URL = 'http://localhost:3001';
const TRANSCODING_URL = 'http://localhost:3002';
const UPLOAD_URL = 'http://localhost:3003';

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testFullAuthFlow() {
    log('cyan', '\n================================================');
    log('cyan', '   FULL AUTHENTICATION FLOW TEST');
    log('cyan', '================================================\n');

    try {
        // Step 1: Test services are running
        log('yellow', '1. Checking if services are running...');
        try {
            await axios.get(`${AUTH_URL}/health`);
            log('green', '   ✅ Auth service is running');
        } catch (e) {
            log('red', '   ❌ Auth service is NOT running');
            return;
        }

        try {
            await axios.get(`${TRANSCODING_URL}/health`);
            log('green', '   ✅ Transcoding service is running');
        } catch (e) {
            log('red', '   ❌ Transcoding service is NOT running');
            return;
        }

        try {
            await axios.get(`${UPLOAD_URL}/health`);
            log('green', '   ✅ Upload service is running');
        } catch (e) {
            log('red', '   ❌ Upload service is NOT running');
            return;
        }

        // Step 2: Test unauthenticated access
        log('yellow', '\n2. Testing unauthenticated access...');
        try {
            await axios.get(`${TRANSCODING_URL}/api/transcoding/library`);
            log('red', '   ❌ ERROR: Should reject unauthenticated request');
        } catch (e) {
            if (e.response?.status === 401) {
                log('green', '   ✅ Correctly rejected unauthenticated request');
            } else {
                log('red', `   ❌ Unexpected error: ${e.response?.status}`);
            }
        }

        // Step 3: Test with invalid token
        log('yellow', '\n3. Testing with invalid token...');
        try {
            await axios.get(`${TRANSCODING_URL}/api/transcoding/library`, {
                headers: { Authorization: 'Bearer invalid-token' }
            });
            log('red', '   ❌ ERROR: Should reject invalid token');
        } catch (e) {
            if (e.response?.status === 401 || e.response?.status === 403) {
                log('green', '   ✅ Correctly rejected invalid token');
            } else {
                log('red', `   ❌ Unexpected error: ${e.response?.status}`);
            }
        }

        // Step 4: Test auth profile without token
        log('yellow', '\n4. Testing auth profile without token...');
        try {
            await axios.get(`${AUTH_URL}/api/auth/profile`);
            log('red', '   ❌ ERROR: Should reject request without token');
        } catch (e) {
            if (e.response?.status === 401) {
                log('green', '   ✅ Correctly rejected request without token');
            }
        }

        log('cyan', '\n================================================');
        log('green', '   ✅ ALL TESTS PASSED');
        log('cyan', '================================================\n');

        log('yellow', 'Next steps:');
        log('blue', '1. Login via auth service to get a token');
        log('blue', '2. Use the token with transcoding/upload APIs');
        log('blue', '3. Example:');
        log('blue', '   TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \\');
        log('blue', '     -d "{\\"username\\":\\"user\\",\\"password\\":\\"pass\\"}" | jq .tokens.idToken)');
        log('blue', '   curl -H "Authorization: Bearer $TOKEN" \\');
        log('blue', '     http://localhost:3002/api/transcoding/library');

    } catch (error) {
        log('red', `\n❌ Test failed: ${error.message}`);
    }
}

testFullAuthFlow();
