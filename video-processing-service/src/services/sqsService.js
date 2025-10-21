const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const transcodingService = require('./transcodingService');

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
                    StringValue: 'video-processing-service'
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
            service: 'video-processing-service',
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ SQS connections initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize SQS:', error);
        throw error;
    }
}

// Process messages from transcoding queue
async function processTranscodingMessage(message) {
    try {
        const messageBody = JSON.parse(message.Body);
        const { action, userId, s3Key, filename, jobId, videoId } = messageBody;

        console.log(`📨 Processing transcoding message: ${action}`);

        switch (action) {
            case 'start-transcoding':
                const inputSource = { type: 's3', key: s3Key };
                const resolutions = ['1920x1080', '1280x720', '854x480'];
                
                // Start transcoding
                const result = await transcodingService.transcodeVideo(
                    videoId || `video_${Date.now()}`,
                    inputSource,
                    resolutions
                );
                
                // Send completion notification
                await sqsService.sendMessage('notification-queue', {
                    action: 'transcoding-completed',
                    userId,
                    videoId: result.videoId,
                    jobId: result.jobId,
                    status: result.status,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'get-status':
                const jobStatus = await transcodingService.getJobStatus(jobId);
                
                // Send status response
                await sqsService.sendMessage('notification-queue', {
                    action: 'status-response',
                    userId,
                    jobId,
                    status: jobStatus,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'list-jobs':
                const activeJobs = await transcodingService.getActiveJobs();
                
                // Send jobs list response
                await sqsService.sendMessage('notification-queue', {
                    action: 'jobs-response',
                    userId,
                    jobs: activeJobs,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'get-metrics':
                const { getCurrentCPUUsage, getCPUUsageHistory, getSystemInfo, getMemoryUsage } = require('../utils/cpuMonitor');
                const metrics = {
                    cpu: {
                        current: await getCurrentCPUUsage(),
                        history: getCPUUsageHistory().slice(-20)
                    },
                    memory: getMemoryUsage(),
                    system: getSystemInfo()
                };
                
                // Send metrics response
                await sqsService.sendMessage('notification-queue', {
                    action: 'metrics-response',
                    userId,
                    metrics,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'test-cpu':
                // CPU test is handled by the API endpoint
                console.log('🔥 CPU test requested');
                break;

            default:
                console.log(`⚠️ Unknown action: ${action}`);
        }
    } catch (error) {
        console.error('❌ Error processing transcoding message:', error);
        
        // Send error notification
        await sqsService.sendMessage('notification-queue', {
            action: 'error',
            service: 'video-processing-service',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Start message processor
function startMessageProcessor() {
    const processMessages = async () => {
        try {
            const response = await sqsService.receiveMessages('transcoding-queue', 10);
            
            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    await processTranscodingMessage(message);
                    await sqsService.deleteMessage('transcoding-queue', message.ReceiptHandle);
                }
            }
        } catch (error) {
            console.error('❌ Error in message processor:', error);
        }
    };

    // Process messages every 5 seconds
    setInterval(processMessages, 5000);
    console.log('🔄 Transcoding message processor started');
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
