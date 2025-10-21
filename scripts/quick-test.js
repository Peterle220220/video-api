#!/usr/bin/env node

const http = require('http');

console.log('⚡ Quick Test - Testing all service endpoints...\n');

const endpoints = [
    { url: 'http://localhost:3001/health', service: 'Auth Service' },
    { url: 'http://localhost:3002/health', service: 'Transcoding Service' },
    { url: 'http://localhost:3003/health', service: 'Upload Service' }
];

let completed = 0;

endpoints.forEach(({ url, service }) => {
    const req = http.get(url, (res) => {
        console.log(`✅ ${service}: ${res.statusCode} - ${url}`);
        completed++;
        if (completed === endpoints.length) {
            console.log('\n🎉 All tests completed!');
            process.exit(0);
        }
    });
    
    req.on('error', (err) => {
        console.log(`❌ ${service}: ${err.message} - ${url}`);
        completed++;
        if (completed === endpoints.length) {
            console.log('\n🎉 All tests completed!');
            process.exit(0);
        }
    });
    
    req.setTimeout(5000, () => {
        console.log(`⏰ ${service}: Timeout - ${url}`);
        req.destroy();
        completed++;
        if (completed === endpoints.length) {
            console.log('\n🎉 All tests completed!');
            process.exit(0);
        }
    });
});
