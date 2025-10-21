require('dotenv').config();

// Script để setup với existing queues hoặc tạo manual
console.log('🔧 SQS Queue Setup Instructions\n');

console.log('❌ Cannot create SQS queues automatically due to AWS permissions.');
console.log('📋 Please create the following queues manually in AWS Console:\n');

console.log('1. Go to AWS SQS Console: https://console.aws.amazon.com/sqs/');
console.log('2. Create the following queues:\n');

const queues = [
    {
        name: 'transcoding-queue',
        url: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue',
        description: 'Handles video transcoding jobs',
        attributes: {
            VisibilityTimeoutSeconds: '1800', // 30 minutes
            MessageRetentionPeriod: '1209600', // 14 days
            ReceiveMessageWaitTimeSeconds: '20'
        }
    },
    {
        name: 'upload-queue', 
        url: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/upload-queue',
        description: 'Handles file upload processing',
        attributes: {
            VisibilityTimeoutSeconds: '300', // 5 minutes
            MessageRetentionPeriod: '1209600', // 14 days
            ReceiveMessageWaitTimeSeconds: '20'
        }
    },
    {
        name: 'storage-queue',
        url: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/storage-queue', 
        description: 'Handles AssemblyAI processing',
        attributes: {
            VisibilityTimeoutSeconds: '1800', // 30 minutes
            MessageRetentionPeriod: '1209600', // 14 days
            ReceiveMessageWaitTimeSeconds: '20'
        }
    },
    {
        name: 'notifications-queue',
        url: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/notifications-queue',
        description: 'Handles system notifications',
        attributes: {
            VisibilityTimeoutSeconds: '60', // 1 minute
            MessageRetentionPeriod: '1209600', // 14 days
            ReceiveMessageWaitTimeSeconds: '20'
        }
    }
];

queues.forEach((queue, index) => {
    console.log(`${index + 1}. ${queue.name}`);
    console.log(`   Description: ${queue.description}`);
    console.log(`   URL: ${queue.url}`);
    console.log(`   Visibility Timeout: ${queue.attributes.VisibilityTimeoutSeconds} seconds`);
    console.log(`   Message Retention: ${queue.attributes.MessageRetentionPeriod} seconds`);
    console.log(`   Long Polling: ${queue.attributes.ReceiveMessageWaitTimeSeconds} seconds`);
    console.log('');
});

console.log('📝 Steps to create queues:');
console.log('1. Click "Create queue" in SQS Console');
console.log('2. Choose "Standard" queue type');
console.log('3. Enter queue name exactly as shown above');
console.log('4. Configure attributes as specified');
console.log('5. Click "Create queue"');
console.log('6. Repeat for all 4 queues\n');

console.log('✅ After creating queues, test with:');
console.log('   node scripts/manage-sqs.js status');
console.log('   node scripts/test-sqs.js\n');

console.log('🔗 Alternative: Use existing queues if available');
console.log('   Update shared/services/sqsService.js with actual queue URLs');
