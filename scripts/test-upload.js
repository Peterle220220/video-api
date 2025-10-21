#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

console.log('📤 Testing Upload Service...\n');

// Set environment variables
const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: '3003',
    AWS_REGION: 'ap-southeast-2',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'ASIA5DYSEEJ4Q3BE2M57',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'rFyG4JmRJ64lEoE1S7K9L1M3N5P7Q9S1U3W5Y7',
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'cab432-a2-n12122882-metadata',
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'cab432-a2-n12122882',
    ASSEMBLY_AI_API_KEY: process.env.ASSEMBLY_AI_API_KEY || '420c9f6d29f742e587313b9764794f45',
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_wgTgFFTuB',
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || '1o00oog3qb82t1qgvi62lfv9fa',
    AAI_API_BASE: process.env.AAI_API_BASE || 'https://api.assemblyai.com/v2',
    AUTH_SERVICE_URL: 'http://localhost:3001',
    TRANSCODING_SERVICE_URL: 'http://localhost:3002'
};

// Start upload service
const uploadProcess = spawn('node', ['src/server.js'], {
    cwd: path.join(__dirname, '../upload-service'),
    env: env,
    stdio: 'inherit'
});

uploadProcess.on('error', (err) => {
    console.error('❌ Failed to start upload service:', err);
});

uploadProcess.on('close', (code) => {
    console.log(`\n📤 Upload service exited with code ${code}`);
});

// Test endpoints after 3 seconds
setTimeout(() => {
    console.log('\n🧪 Testing upload endpoints...');
    
    const testEndpoints = [
        'http://localhost:3003/health',
        'http://localhost:3003/api/storage/health',
        'http://localhost:3003/api/videos/health'
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
    console.log('\n🛑 Stopping upload service...');
    uploadProcess.kill();
    process.exit(0);
});
