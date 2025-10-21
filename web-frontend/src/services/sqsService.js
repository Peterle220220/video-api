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
                    StringValue: 'web-frontend-service'
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
            service: 'web-frontend-service',
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ SQS connections initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize SQS:', error);
        throw error;
    }
}

// Process messages from notification queue
async function processNotificationMessage(message, io) {
    try {
        const messageBody = JSON.parse(message.Body);
        const { action, userId, data } = messageBody;

        console.log(`📨 Processing notification: ${action}`);

        switch (action) {
            case 'transcoding-completed':
                // Broadcast to all connected clients
                io.emit('transcoding-completed', {
                    userId,
                    videoId: data.videoId,
                    jobId: data.jobId,
                    status: data.status,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'status-update':
                // Broadcast status update to specific user
                io.to(`user_${userId}`).emit('status-update', {
                    jobId: data.jobId,
                    status: data.status,
                    progress: data.progress,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'presign-upload-response':
                // Send upload URL to specific user
                io.to(`user_${userId}`).emit('upload-url', {
                    key: data.key,
                    uploadUrl: data.uploadUrl,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'presign-download-response':
                // Send download URL to specific user
                io.to(`user_${userId}`).emit('download-url', {
                    key: data.key,
                    downloadUrl: data.downloadUrl,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'error':
                // Broadcast error to all clients
                io.emit('error', {
                    service: data.service,
                    error: data.error,
                    timestamp: new Date().toISOString()
                });
                break;

            default:
                console.log(`⚠️ Unknown notification action: ${action}`);
        }
    } catch (error) {
        console.error('❌ Error processing notification message:', error);
    }
}

// Start message processor
function startMessageProcessor(io) {
    const processMessages = async () => {
        try {
            const response = await sqsService.receiveMessages('notification-queue', 10);
            
            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    await processNotificationMessage(message, io);
                    await sqsService.deleteMessage('notification-queue', message.ReceiptHandle);
                }
            }
        } catch (error) {
            console.error('❌ Error in message processor:', error);
        }
    };

    // Process messages every 2 seconds for real-time updates
    setInterval(processMessages, 2000);
    console.log('🔄 Notification message processor started');
}

module.exports = {
    sqsService,
    initializeSQS,
    startMessageProcessor,
    sendMessage: (queueName, messageBody, attributes) => 
        sqsService.sendMessage(queueName, messageBody, attributes),
    receiveMessages: (queueName, maxMessages) => 
        sqsService.receiveMessages(queueName, maxMessages),
    deleteMessage: (queueName, receiptHandle) => 
        sqsService.deleteMessage(queueName, receiptHandle)
};
