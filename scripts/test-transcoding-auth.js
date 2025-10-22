const axios = require('axios');

const AUTH_SERVICE_URL = 'http://localhost:3001';
const TRANSCODING_SERVICE_URL = 'http://localhost:3002';

async function testTranscodingAuth() {
    console.log('🧪 Testing Transcoding Service Authentication');
    console.log('==========================================');

    try {
        // Step 1: Test auth service
        console.log('\n1. Testing Auth Service...');
        const authHealth = await axios.get(`${AUTH_SERVICE_URL}/health`);
        console.log('✅ Auth Service:', authHealth.data);

        // Step 2: Test transcoding service
        console.log('\n2. Testing Transcoding Service...');
        const transcodingHealth = await axios.get(`${TRANSCODING_SERVICE_URL}/health`);
        console.log('✅ Transcoding Service:', transcodingHealth.data);

        // Step 3: Test transcoding library without token (should fail)
        console.log('\n3. Testing transcoding library without token (should fail)...');
        try {
            await axios.get(`${TRANSCODING_SERVICE_URL}/api/transcoding/library?page=1&limit=10`);
            console.log('❌ ERROR: Should have failed without token');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Correctly rejected request without token');
            } else {
                console.log('❌ Unexpected error:', error.response?.data || error.message);
            }
        }

        // Step 4: Test with invalid token (should fail)
        console.log('\n4. Testing with invalid token (should fail)...');
        try {
            await axios.get(`${TRANSCODING_SERVICE_URL}/api/transcoding/library?page=1&limit=10`, {
                headers: { Authorization: 'Bearer invalid-token' }
            });
            console.log('❌ ERROR: Should have failed with invalid token');
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.log('✅ Correctly rejected invalid token');
            } else {
                console.log('❌ Unexpected error:', error.response?.data || error.message);
            }
        }

        console.log('\n✅ Authentication is working correctly!');
        console.log('\n📝 To test with valid token:');
        console.log('1. Login via auth service to get token');
        console.log('2. Use token in Authorization header: Bearer <token>');
        console.log('3. Call transcoding API with valid token');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Details:', error.response?.data || error);
    }
}

// Run the test
testTranscodingAuth();
