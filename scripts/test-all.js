#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Testing All Services...\n');

// Set environment variables
const env = {
    ...process.env,
    NODE_ENV: 'development',
    AWS_REGION: 'ap-southeast-2',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'ASIA5DYSEEJ4QHYJLKMQ',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'zyq30lRvNmB7egwzjrM7WtgTfxTPj+THOpTssLdL',
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'cab432-a2-n12122882-metadata',
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'cab432-a2-n12122882',
    ASSEMBLY_AI_API_KEY: process.env.ASSEMBLY_AI_API_KEY || '420c9f6d29f742e587313b9764794f45',
    AAI_API_BASE: process.env.AAI_API_BASE || 'https://api.assemblyai.com/v2',
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_wgTgFFTuB',
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || '1o00oog3qb82t1qgvi62lfv9fa',
    SQS_TRANSCODING_QUEUE_URL: process.env.SQS_TRANSCODING_QUEUE_URL || 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue'
};

const services = [];

// Start Auth Service
console.log('🔐 Starting Auth Service...');
const authProcess = spawn('node', ['src/server.js'], {
    cwd: path.join(__dirname, '../auth-service'),
    env: { ...env, PORT: '3001' },
    stdio: 'pipe'
});
services.push({ name: 'Auth', process: authProcess, port: 3001 });

// Start Transcoding Service
console.log('🎬 Starting Transcoding Service...');
const transcodingProcess = spawn('node', ['src/server.js'], {
    cwd: path.join(__dirname, '../transcoding-service'),
    env: { ...env, PORT: '3002' },
    stdio: 'pipe'
});
services.push({ name: 'Transcoding', process: transcodingProcess, port: 3002 });

// Start Upload Service
console.log('📤 Starting Upload Service...');
const uploadProcess = spawn('node', ['src/server.js'], {
    cwd: path.join(__dirname, '../upload-service'),
    env: { ...env, PORT: '3003' },
    stdio: 'pipe'
});
services.push({ name: 'Upload', process: uploadProcess, port: 3003 });

// Handle service output
services.forEach(service => {
    service.process.stdout.on('data', (data) => {
        console.log(`[${service.name}] ${data.toString().trim()}`);
    });
    
    service.process.stderr.on('data', (data) => {
        console.error(`[${service.name}] ERROR: ${data.toString().trim()}`);
    });
    
    service.process.on('error', (err) => {
        console.error(`❌ Failed to start ${service.name} service:`, err);
    });
    
    service.process.on('close', (code) => {
        console.log(`\n[${service.name}] Service exited with code ${code}`);
    });
});

// Test all endpoints after 5 seconds
setTimeout(() => {
    console.log('\n🧪 Testing all endpoints...');
    
    const testEndpoints = [
        { url: 'http://localhost:3001/health', service: 'Auth' },
        { url: 'http://localhost:3002/health', service: 'Transcoding' },
        { url: 'http://localhost:3003/health', service: 'Upload' },
        { url: 'http://localhost:3001/api/auth/health', service: 'Auth API' },
        { url: 'http://localhost:3002/api/transcoding/health', service: 'Transcoding API' },
        { url: 'http://localhost:3003/api/storage/health', service: 'Upload API' }
    ];
    
    testEndpoints.forEach(({ url, service }) => {
        const http = require('http');
        const req = http.get(url, (res) => {
            console.log(`✅ [${service}] ${url}: ${res.statusCode}`);
        });
        req.on('error', (err) => {
            console.log(`❌ [${service}] ${url}: ${err.message}`);
        });
    });
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping all services...');
    services.forEach(service => {
        service.process.kill();
    });
    process.exit(0);
});
