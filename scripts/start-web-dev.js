#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Starting Web Development Environment...\n');

// Set environment variables
const env = {
    ...process.env,
    NODE_ENV: 'development',
    AWS_REGION: 'ap-southeast-2',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'ASIA5DYSEEJ4Q3BE2M57',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'rFyG4JmRJ64lEoE1S7K9L1M3N5P7Q9S1U3W5Y7',
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

// Wait for services to start, then show access info
setTimeout(() => {
    console.log('\n🌐 WEB ACCESS INFORMATION:');
    console.log('========================');
    console.log('🔗 Frontend Web App: http://localhost:3000');
    console.log('🔗 Auth Service API: http://localhost:3001');
    console.log('🔗 Transcoding API: http://localhost:3002');
    console.log('🔗 Upload API: http://localhost:3003');
    console.log('');
    console.log('📋 Available Endpoints:');
    console.log('  • Health Checks: /health');
    console.log('  • Auth API: /api/auth/*');
    console.log('  • Transcoding API: /api/transcoding/*');
    console.log('  • Upload API: /api/storage/*, /api/videos/*');
    console.log('');
    console.log('🎯 To access the web application:');
    console.log('  1. Open browser and go to: http://localhost:3000');
    console.log('  2. The React app will connect to the backend services');
    console.log('  3. All API calls will be routed through the microservices');
    console.log('');
    console.log('🛑 Press Ctrl+C to stop all services');
}, 3000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping all services...');
    services.forEach(service => {
        service.process.kill();
    });
    process.exit(0);
});
