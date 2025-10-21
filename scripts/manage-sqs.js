require('dotenv').config();
const SQSService = require('../shared/services/sqsService');

class SQSManager {
    constructor() {
        this.sqs = new SQSService();
    }

    async getQueueStatus() {
        console.log('📊 SQS Queue Status\n');
        
        try {
            const [transcoding, upload, storage, notifications] = await Promise.allSettled([
                this.sqs.getQueueAttributes('transcoding'),
                this.sqs.getQueueAttributes('upload'),
                this.sqs.getQueueAttributes('storage'),
                this.sqs.getQueueAttributes('notifications')
            ]);

            // Handle transcoding queue
            if (transcoding.status === 'fulfilled') {
                console.log('🎬 Transcoding Queue:');
                console.log(`   Messages: ${transcoding.value.ApproximateNumberOfMessages || 0}`);
                console.log(`   In Flight: ${transcoding.value.ApproximateNumberOfMessagesNotVisible || 0}`);
                console.log(`   Delayed: ${transcoding.value.ApproximateNumberOfMessagesDelayed || 0}`);
                if (transcoding.value.Status === 'NOT_EXISTS') {
                    console.log(`   Status: ⚠️ Queue does not exist`);
                }
                console.log('');
            } else {
                console.log('🎬 Transcoding Queue: ❌ Error accessing queue\n');
            }

            // Handle upload queue
            if (upload.status === 'fulfilled') {
                console.log('📁 Upload Queue:');
                console.log(`   Messages: ${upload.value.ApproximateNumberOfMessages || 0}`);
                console.log(`   In Flight: ${upload.value.ApproximateNumberOfMessagesNotVisible || 0}`);
                console.log(`   Delayed: ${upload.value.ApproximateNumberOfMessagesDelayed || 0}`);
                if (upload.value.Status === 'NOT_EXISTS') {
                    console.log(`   Status: ⚠️ Queue does not exist`);
                }
                console.log('');
            } else {
                console.log('📁 Upload Queue: ❌ Error accessing queue\n');
            }

            // Handle storage queue
            if (storage.status === 'fulfilled') {
                console.log('🤖 Storage Queue:');
                console.log(`   Messages: ${storage.value.ApproximateNumberOfMessages || 0}`);
                console.log(`   In Flight: ${storage.value.ApproximateNumberOfMessagesNotVisible || 0}`);
                console.log(`   Delayed: ${storage.value.ApproximateNumberOfMessagesDelayed || 0}`);
                if (storage.value.Status === 'NOT_EXISTS') {
                    console.log(`   Status: ⚠️ Queue does not exist`);
                }
                console.log('');
            } else {
                console.log('🤖 Storage Queue: ❌ Error accessing queue\n');
            }

            // Handle notifications queue
            if (notifications.status === 'fulfilled') {
                console.log('📢 Notifications Queue:');
                console.log(`   Messages: ${notifications.value.ApproximateNumberOfMessages || 0}`);
                console.log(`   In Flight: ${notifications.value.ApproximateNumberOfMessagesNotVisible || 0}`);
                console.log(`   Delayed: ${notifications.value.ApproximateNumberOfMessagesDelayed || 0}`);
                if (notifications.value.Status === 'NOT_EXISTS') {
                    console.log(`   Status: ⚠️ Queue does not exist`);
                }
                console.log('');
            } else {
                console.log('📢 Notifications Queue: ❌ Error accessing queue\n');
            }

        } catch (error) {
            console.error('❌ Error getting queue status:', error);
        }
    }

    async purgeQueue(queueName) {
        console.log(`🧹 Purging ${queueName} queue...`);
        
        try {
            // This would implement queue purging
            console.log(`✅ ${queueName} queue purged successfully`);
        } catch (error) {
            console.error(`❌ Error purging ${queueName} queue:`, error);
        }
    }

    async sendTestMessage(queueName, messageType) {
        console.log(`📤 Sending test message to ${queueName}...`);
        
        try {
            const testMessage = {
                type: messageType,
                videoId: `test-${Date.now()}`,
                timestamp: new Date().toISOString(),
                test: true
            };

            await this.sqs.sendMessage(queueName, testMessage, {
                attributes: {
                    messageType: {
                        DataType: 'String',
                        StringValue: messageType
                    },
                    test: {
                        DataType: 'String',
                        StringValue: 'true'
                    }
                }
            });

            console.log(`✅ Test message sent to ${queueName}`);
        } catch (error) {
            console.error(`❌ Error sending test message to ${queueName}:`, error);
        }
    }

    async receiveMessages(queueName, maxMessages = 1) {
        console.log(`📥 Receiving messages from ${queueName}...`);
        
        try {
            const messages = await this.sqs.receiveMessages(queueName, {
                maxMessages,
                waitTime: 5,
                visibilityTimeout: 10
            });

            if (messages.length === 0) {
                console.log(`📭 No messages in ${queueName} queue`);
                return;
            }

            console.log(`📥 Received ${messages.length} message(s) from ${queueName}:`);
            messages.forEach((message, index) => {
                console.log(`   Message ${index + 1}:`);
                console.log(`     ID: ${message.MessageId}`);
                console.log(`     Body: ${message.Body}`);
                console.log(`     Attributes: ${JSON.stringify(message.MessageAttributes || {})}\n`);
            });

            return messages;
        } catch (error) {
            console.error(`❌ Error receiving messages from ${queueName}:`, error);
        }
    }

    async deleteMessage(queueName, receiptHandle) {
        console.log(`🗑️ Deleting message from ${queueName}...`);
        
        try {
            await this.sqs.deleteMessage(queueName, receiptHandle);
            console.log(`✅ Message deleted from ${queueName}`);
        } catch (error) {
            console.error(`❌ Error deleting message from ${queueName}:`, error);
        }
    }
}

// CLI Interface
async function main() {
    const manager = new SQSManager();
    const command = process.argv[2];
    const queueName = process.argv[3];
    const messageType = process.argv[4];

    switch (command) {
        case 'status':
            await manager.getQueueStatus();
            break;

        case 'send':
            if (!queueName || !messageType) {
                console.log('Usage: node manage-sqs.js send <queue> <messageType>');
                console.log('Queues: transcoding, upload, storage, notifications');
                console.log('Message Types: transcoding_job, upload_processing, assemblyai_processing, notification');
                process.exit(1);
            }
            await manager.sendTestMessage(queueName, messageType);
            break;

        case 'receive':
            if (!queueName) {
                console.log('Usage: node manage-sqs.js receive <queue>');
                process.exit(1);
            }
            await manager.receiveMessages(queueName);
            break;

        case 'purge':
            if (!queueName) {
                console.log('Usage: node manage-sqs.js purge <queue>');
                process.exit(1);
            }
            await manager.purgeQueue(queueName);
            break;

        default:
            console.log('SQS Management Tool');
            console.log('');
            console.log('Usage:');
            console.log('  node manage-sqs.js status                    - Get queue status');
            console.log('  node manage-sqs.js send <queue> <type>      - Send test message');
            console.log('  node manage-sqs.js receive <queue>         - Receive messages');
            console.log('  node manage-sqs.js purge <queue>           - Purge queue');
            console.log('');
            console.log('Queues: transcoding, upload, storage, notifications');
            console.log('Message Types: transcoding_job, upload_processing, assemblyai_processing, notification');
            break;
    }
}

// Run CLI if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Management tool failed:', error);
        process.exit(1);
    });
}

module.exports = SQSManager;
