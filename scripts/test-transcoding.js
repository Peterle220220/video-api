#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

console.log('🎬 Testing Transcoding Service...\n');

// Set environment variables
const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: '3002',
    AWS_REGION: 'ap-southeast-2',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'ASIA5DYSEEJ4QHYJLKMQ',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'zyq30lRvNmB7egwzjrM7WtgTfxTPj+THOpTssLdL',
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'cab432-a2-n12122882-metadata',
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'cab432-a2-n12122882',
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_wgTgFFTuB',
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || '1o00oog3qb82t1qgvi62lfv9fa',
    AUTH_SERVICE_URL: 'http://localhost:3001',
    UPLOAD_SERVICE_URL: 'http://localhost:3003',
    SQS_TRANSCODING_QUEUE_URL: process.env.SQS_TRANSCODING_QUEUE_URL || 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue'
};

// Start transcoding service
const transcodingProcess = spawn('node', ['src/server.js'], {
    cwd: path.join(__dirname, '../transcoding-service'),
    env: env,
    stdio: 'inherit'
});

transcodingProcess.on('error', (err) => {
    console.error('❌ Failed to start transcoding service:', err);
});

transcodingProcess.on('close', (code) => {
    console.log(`\n🎬 Transcoding service exited with code ${code}`);
});

// Test endpoints after 3 seconds
setTimeout(() => {
    console.log('\n🧪 Testing transcoding endpoints...');
    
    const testEndpoints = [
        'http://localhost:3002/health',
        'http://localhost:3002/api/transcoding/health',
        'http://localhost:3002/api/transcoding/queue/status'
    ];
    
    testEndpoints.forEach(url => {
        const http = require('http');
        const req = http.get(url, (res) => {
            console.log(`✅ ${url}: ${res.statusCode}`);
        });
        req.on('error', (err) => {
            console.log(`❌ ${url}: ${err.message}`);
        });
    });
}, 3000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping transcoding service...');
    transcodingProcess.kill();
    process.exit(0);
});
