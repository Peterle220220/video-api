const jwt = require('jsonwebtoken');

// Test script để kiểm tra JWT expiry handling
async function testJwtExpiry() {
    console.log('🧪 Testing JWT expiry handling...\n');

    // Tạo một JWT token đã hết hạn (expired 1 giờ trước)
    const expiredToken = jwt.sign(
        { 
            sub: 'test-user',
            username: 'testuser',
            email: 'test@example.com',
            exp: Math.floor(Date.now() / 1000) - 3600 // Hết hạn 1 giờ trước
        },
        'test-secret',
        { expiresIn: '1h' }
    );

    console.log('📝 Created expired JWT token');
    console.log('🔍 Token payload:', jwt.decode(expiredToken));
    console.log('⏰ Expired at:', new Date(jwt.decode(expiredToken).exp * 1000).toISOString());
    console.log('');

    // Test auth service verify endpoint
    console.log('🔐 Testing Auth Service /verify endpoint...');
    try {
        const response = await fetch('http://localhost:3001/api/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: expiredToken })
        });

        const result = await response.json();
        console.log('📊 Status Code:', response.status);
        console.log('📋 Response:', result);

        if (response.status === 401 && result.error === 'Token expired') {
            console.log('✅ Auth Service correctly returns 401 for expired token');
        } else {
            console.log('❌ Auth Service does not handle expired token correctly');
        }
    } catch (error) {
        console.log('❌ Error testing Auth Service:', error.message);
    }

    console.log('');

    // Test video-api với expired token
    console.log('🎥 Testing Video API with expired token...');
    try {
        const response = await fetch('http://localhost:3000/api/videos', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${expiredToken}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('📊 Status Code:', response.status);
        console.log('📋 Response:', result);

        if (response.status === 401 && result.error === 'Token expired') {
            console.log('✅ Video API correctly returns 401 for expired token');
        } else {
            console.log('❌ Video API does not handle expired token correctly');
        }
    } catch (error) {
        console.log('❌ Error testing Video API:', error.message);
    }

    console.log('');

    // Test transcoding service với expired token
    console.log('🔄 Testing Transcoding Service with expired token...');
    try {
        const response = await fetch('http://localhost:3002/api/transcoding/status', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${expiredToken}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('📊 Status Code:', response.status);
        console.log('📋 Response:', result);

        if (response.status === 401 && result.error === 'Token expired') {
            console.log('✅ Transcoding Service correctly returns 401 for expired token');
        } else {
            console.log('❌ Transcoding Service does not handle expired token correctly');
        }
    } catch (error) {
        console.log('❌ Error testing Transcoding Service:', error.message);
    }

    console.log('');

    // Test upload service với expired token
    console.log('📤 Testing Upload Service with expired token...');
    try {
        const response = await fetch('http://localhost:3003/api/upload/status', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${expiredToken}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('📊 Status Code:', response.status);
        console.log('📋 Response:', result);

        if (response.status === 401 && result.error === 'Token expired') {
            console.log('✅ Upload Service correctly returns 401 for expired token');
        } else {
            console.log('❌ Upload Service does not handle expired token correctly');
        }
    } catch (error) {
        console.log('❌ Error testing Upload Service:', error.message);
    }

    console.log('\n🎯 Test Summary:');
    console.log('- JWT expiry handling should return 401 status code');
    console.log('- Response should contain error: "Token expired"');
    console.log('- This allows web frontend to detect expired tokens and sign out users');
}

// Chạy test nếu file được execute trực tiếp
if (require.main === module) {
    testJwtExpiry().catch(console.error);
}

module.exports = { testJwtExpiry };
