require('dotenv').config();
const SQSService = require('../shared/services/sqsService');

async function testNewQueues() {
    console.log('🧪 Testing New SQS Queues...\n');

    const sqs = new SQSService();

    try {
        // Test upload queue
        console.log('📤 Testing upload-queue...');
        const uploadMessage = {
            type: 'upload_processing',
            videoId: 'test-upload-' + Date.now(),
            s3Key: 'videos/test-upload.mp4',
            filename: 'test-upload.mp4',
            timestamp: new Date().toISOString()
        };

        await sqs.sendMessage('upload', uploadMessage, {
            attributes: {
                jobType: {
                    DataType: 'String',
                    StringValue: 'upload_processing'
                },
                test: {
                    DataType: 'String',
                    StringValue: 'true'
                }
            }
        });
        console.log('✅ Upload message sent successfully\n');

        // Test notifications queue
        console.log('📤 Testing notifications-queue...');
        const notificationMessage = {
            type: 'notification',
            message: 'Test notification from Video API',
            timestamp: new Date().toISOString(),
            priority: 'info'
        };

        await sqs.sendMessage('notifications', notificationMessage, {
            attributes: {
                messageType: {
                    DataType: 'String',
                    StringValue: 'notification'
                },
                priority: {
                    DataType: 'String',
                    StringValue: 'info'
                }
            }
        });
        console.log('✅ Notification message sent successfully\n');

        // Test receive messages
        console.log('📥 Testing message receive...');
        
        // Receive from upload queue
        const uploadMessages = await sqs.receiveMessages('upload', {
            maxMessages: 1,
            waitTime: 5,
            visibilityTimeout: 10
        });

        if (uploadMessages.length > 0) {
            console.log(`📥 Received ${uploadMessages.length} message(s) from upload queue`);
            console.log(`   Message: ${uploadMessages[0].Body}`);
            
            // Delete the message
            await sqs.deleteMessage('upload', uploadMessages[0].ReceiptHandle);
            console.log('✅ Upload test message deleted');
        } else {
            console.log('📭 No messages in upload queue');
        }

        // Receive from notifications queue
        const notificationMessages = await sqs.receiveMessages('notifications', {
            maxMessages: 1,
            waitTime: 5,
            visibilityTimeout: 10
        });

        if (notificationMessages.length > 0) {
            console.log(`📥 Received ${notificationMessages.length} message(s) from notifications queue`);
            console.log(`   Message: ${notificationMessages[0].Body}`);
            
            // Delete the message
            await sqs.deleteMessage('notifications', notificationMessages[0].ReceiptHandle);
            console.log('✅ Notification test message deleted');
        } else {
            console.log('📭 No messages in notifications queue');
        }

        console.log('\n🎉 All new queues working successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Check queue status: npm run manage-sqs status');
        console.log('2. Start microservices: npm start');
        console.log('3. Monitor DLQ for failed messages');

    } catch (error) {
        console.error('❌ Error testing new queues:', error);
        
        if (error.message.includes('Queue') && error.message.includes('not found')) {
            console.log('\n💡 Solution: Make sure you created the queues in AWS Console');
            console.log('   - upload-queue');
            console.log('   - notifications-queue');
        }
    }
}

// Run test
if (require.main === module) {
    testNewQueues();
}

module.exports = testNewQueues;
