#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing import paths in all services...\n');

const fixes = [
    // Fix dynamoService.js
    {
        file: 'upload-service/src/services/dynamoService.js',
        changes: [
            { from: "require('../../config/aws')", to: "require('../config/aws')" },
            { from: "require('../cache/memcached')", to: "// require('../cache/memcached') // Disabled" }
        ]
    },
    {
        file: 'transcoding-service/src/services/dynamoService.js',
        changes: [
            { from: "require('../../config/aws')", to: "require('../config/aws')" },
            { from: "require('../cache/memcached')", to: "// require('../cache/memcached') // Disabled" }
        ]
    },
    // Fix s3Service.js
    {
        file: 'upload-service/src/services/s3Service.js',
        changes: [
            { from: "require('../../config/aws')", to: "require('../config/aws')" },
            { from: "require('../cache/memcached')", to: "// require('../cache/memcached') // Disabled" }
        ]
    },
    {
        file: 'transcoding-service/src/services/s3Service.js',
        changes: [
            { from: "require('../../config/aws')", to: "require('../config/aws')" },
            { from: "require('../cache/memcached')", to: "// require('../cache/memcached') // Disabled" }
        ]
    },
    // Fix assemblyAIService.js
    {
        file: 'upload-service/src/services/assemblyAIService.js',
        changes: [
            { from: "require('../storage/s3Service')", to: "require('./s3Service')" },
            { from: "require('../db/dynamoService')", to: "require('./dynamoService')" }
        ]
    }
];

fixes.forEach(({ file, changes }) => {
    const filePath = path.join(__dirname, '..', file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⏭️  Skipping ${file} (not found)`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    changes.forEach(({ from, to }) => {
        if (content.includes(from)) {
            content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
            modified = true;
        }
    });
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed ${file}`);
    } else {
        console.log(`⏭️  No changes needed for ${file}`);
    }
});

console.log('\n🎉 All import paths fixed!');

