const { SQSClient, CreateQueueCommand, GetQueueUrlCommand, SendMessageCommand } = require('@aws-sdk/client-sqs');

class QueueManager {
    constructor() {
        this.sqs = new SQSClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
        this.queues = {};
    }

    async ensureQueueExists(queueName, attributes = {}) {
        try {
            // Try to get existing queue
            const getUrlCommand = new GetQueueUrlCommand({ QueueName: queueName });
            const result = await this.sqs.send(getUrlCommand);
            this.queues[queueName] = result.QueueUrl;
            console.log(`✅ Queue ${queueName} already exists: ${result.QueueUrl}`);
            return result.QueueUrl;
        } catch (error) {
            if (error.name === 'AWS.SimpleQueueService.NonExistentQueue') {
                // Queue doesn't exist, create it
                console.log(`📦 Creating queue: ${queueName}`);
                const createCommand = new CreateQueueCommand({
                    QueueName: queueName,
                    Attributes: {
                        VisibilityTimeoutSeconds: '30',
                        MessageRetentionPeriod: '1209600', // 14 days
                        ...attributes
                    }
                });
                const result = await this.sqs.send(createCommand);
                this.queues[queueName] = result.QueueUrl;
                console.log(`✅ Created queue ${queueName}: ${result.QueueUrl}`);
                return result.QueueUrl;
            }
            throw error;
        }
    }

    async initializeQueues() {
        console.log('🚀 Initializing SQS queues...');
        
        // Create dead letter queue first
        await this.ensureQueueExists('dead-letter-queue');
        
        // Create other queues
        await this.ensureQueueExists('storage-queue', {
            ReceiveMessageWaitTimeSeconds: '20'
        });
        
        await this.ensureQueueExists('transcoding-queue', {
            VisibilityTimeoutSeconds: '300', // 5 minutes
            ReceiveMessageWaitTimeSeconds: '20'
        });
        
        await this.ensureQueueExists('notification-queue', {
            ReceiveMessageWaitTimeSeconds: '20'
        });

        // Set environment variables
        process.env.STORAGE_QUEUE_URL = this.queues['storage-queue'];
        process.env.TRANSCODING_QUEUE_URL = this.queues['transcoding-queue'];
        process.env.NOTIFICATION_QUEUE_URL = this.queues['notification-queue'];
        process.env.DEAD_LETTER_QUEUE_URL = this.queues['dead-letter-queue'];

        console.log('✅ All queues initialized successfully!');
        return this.queues;
    }

    getQueueUrl(queueName) {
        return this.queues[queueName];
    }
}

module.exports = QueueManager;
