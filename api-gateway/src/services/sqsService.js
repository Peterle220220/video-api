const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

class SQSService {
    constructor() {
        this.sqs = new SQSClient({ 
            region: process.env.AWS_REGION || 'ap-southeast-2' 
        });
        this.queues = {
            'storage-queue': process.env.STORAGE_QUEUE_URL,
            'transcoding-queue': process.env.TRANSCODING_QUEUE_URL,
            'notification-queue': process.env.NOTIFICATION_QUEUE_URL
        };
    }

    async sendMessage(queueName, messageBody, messageAttributes = {}) {
        const queueUrl = this.queues[queueName];
        if (!queueUrl) {
            throw new Error(`Queue ${queueName} not configured`);
        }

        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(messageBody),
            MessageAttributes: {
                timestamp: {
                    DataType: 'String',
                    StringValue: new Date().toISOString()
                },
                service: {
                    DataType: 'String',
                    StringValue: 'api-gateway'
                },
                ...messageAttributes
            }
        });

        return await this.sqs.send(command);
    }

    async receiveMessages(queueName, maxMessages = 10) {
        const queueUrl = this.queues[queueName];
        if (!queueUrl) {
            throw new Error(`Queue ${queueName} not configured`);
        }

        const command = new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: maxMessages,
            WaitTimeSeconds: 20,
            MessageAttributeNames: ['All']
        });

        return await this.sqs.send(command);
    }

    async deleteMessage(queueName, receiptHandle) {
        const queueUrl = this.queues[queueName];
        if (!queueUrl) {
            throw new Error(`Queue ${queueName} not configured`);
        }

        const command = new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle
        });

        return await this.sqs.send(command);
    }
}

const sqsService = new SQSService();

// Initialize SQS connections
async function initializeSQS() {
    try {
        console.log('🔗 Initializing SQS connections...');
        
        // Test connection by sending a test message
        await sqsService.sendMessage('notification-queue', {
            action: 'service-startup',
            service: 'api-gateway',
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ SQS connections initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize SQS:', error);
        throw error;
    }
}

module.exports = {
    sqsService,
    initializeSQS,
    sendMessage: (queueName, messageBody, attributes) => 
        sqsService.sendMessage(queueName, messageBody, attributes),
    receiveMessages: (queueName, maxMessages) => 
        sqsService.receiveMessages(queueName, maxMessages),
    deleteMessage: (queueName, receiptHandle) => 
        sqsService.deleteMessage(queueName, receiptHandle)
};
