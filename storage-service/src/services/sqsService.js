const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { presignUpload, presignDownload, builds3KeyForUpload } = require('./s3Service');

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
                    StringValue: 'storage-service'
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
            service: 'storage-service',
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ SQS connections initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize SQS:', error);
        throw error;
    }
}

// Process messages from storage queue
async function processStorageMessage(message) {
    try {
        const messageBody = JSON.parse(message.Body);
        const { action, userId, filename, contentType, key } = messageBody;

        console.log(`📨 Processing storage message: ${action}`);

        switch (action) {
            case 'presign-upload':
                const uploadKey = builds3KeyForUpload(filename);
                const uploadUrl = await presignUpload(uploadKey, { contentType });
                
                // Send response back to API Gateway
                await sqsService.sendMessage('notification-queue', {
                    action: 'presign-upload-response',
                    userId,
                    key: uploadKey,
                    uploadUrl,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'presign-download':
                const downloadUrl = await presignDownload(key);
                
                // Send response back to API Gateway
                await sqsService.sendMessage('notification-queue', {
                    action: 'presign-download-response',
                    userId,
                    key,
                    downloadUrl,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'file-uploaded':
                // File has been uploaded, trigger transcoding
                await sqsService.sendMessage('transcoding-queue', {
                    action: 'start-transcoding',
                    userId,
                    s3Key: key,
                    filename,
                    timestamp: new Date().toISOString()
                });
                break;

            default:
                console.log(`⚠️ Unknown action: ${action}`);
        }
    } catch (error) {
        console.error('❌ Error processing storage message:', error);
        
        // Send error notification
        await sqsService.sendMessage('notification-queue', {
            action: 'error',
            service: 'storage-service',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Start message processor
function startMessageProcessor() {
    const processMessages = async () => {
        try {
            const response = await sqsService.receiveMessages('storage-queue', 10);
            
            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    await processStorageMessage(message);
                    await sqsService.deleteMessage('storage-queue', message.ReceiptHandle);
                }
            }
        } catch (error) {
            console.error('❌ Error in message processor:', error);
        }
    };

    // Process messages every 5 seconds
    setInterval(processMessages, 5000);
    console.log('🔄 Storage message processor started');
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
