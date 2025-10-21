require('dotenv').config();
const SQSService = require('../shared/services/sqsService');

// Script để test với existing queues
async function testExistingQueues() {
    console.log('🧪 Testing with existing SQS queues...\n');

    const sqs = new SQSService();

    try {
        // Test với queue đã tồn tại (transcoding-queue)
        console.log('📤 Testing transcoding queue...');
        
        const testMessage = {
            type: 'transcoding_job',
            videoId: 'test-existing-queue',
            inputSource: { type: 's3', key: 'test/test.mp4' },
            resolutions: ['1920x1080'],
            timestamp: new Date().toISOString(),
            test: true
        };

        await sqs.sendMessage('transcoding', testMessage, {
            attributes: {
                jobType: {
                    DataType: 'String',
                    StringValue: 'transcoding'
                },
                test: {
                    DataType: 'String', 
                    StringValue: 'true'
                }
            }
        });

        console.log('✅ Message sent to transcoding queue successfully\n');

        // Test receive message
        console.log('📥 Testing message receive...');
        const messages = await sqs.receiveMessages('transcoding', {
            maxMessages: 1,
            waitTime: 5,
            visibilityTimeout: 10
        });

        if (messages.length > 0) {
            console.log(`📥 Received ${messages.length} message(s):`);
            console.log(`   Message: ${messages[0].Body}`);
            
            // Delete the test message
            await sqs.deleteMessage('transcoding', messages[0].ReceiptHandle);
            console.log('✅ Test message deleted');
        } else {
            console.log('📭 No messages received');
        }

        console.log('\n🎉 SQS testing with existing queues successful!');
        console.log('\n📋 Next steps:');
        console.log('1. Create missing queues manually in AWS Console');
        console.log('2. Or update queue URLs in shared/services/sqsService.js');
        console.log('3. Test again with: node scripts/manage-sqs.js status');

    } catch (error) {
        console.error('❌ Error testing existing queues:', error);
        
        if (error.name === 'QueueDoesNotExist') {
            console.log('\n💡 Solution: Create the missing queue in AWS Console');
            console.log('   Queue URL: https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue');
        }
    }
}

// Run test
if (require.main === module) {
    testExistingQueues();
}

module.exports = testExistingQueues;
