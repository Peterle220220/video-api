const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, CreateQueueCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

class SQSService {
    constructor(region = 'ap-southeast-2') {
        this.client = new SQSClient({ region });
        this.region = region;
        this.queues = {
            transcoding: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue',
            upload: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/upload-queue',
            storage: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/storage-queue',
            notifications: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/notifications-queue'
        };
    }

    // Send message to queue
    async sendMessage(queueName, messageBody, options = {}) {
        try {
            const queueUrl = this.queues[queueName];
            if (!queueUrl) {
                throw new Error(`Queue ${queueName} not found`);
            }

            const command = new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody),
                DelaySeconds: options.delaySeconds || 0,
                MessageAttributes: options.attributes || {}
            });

            const response = await this.client.send(command);
            console.log(`✅ Message sent to ${queueName}:`, response.MessageId);
            return response;
        } catch (error) {
            console.error(`❌ Error sending message to ${queueName}:`, error);
            throw error;
        }
    }

    // Receive messages from queue
    async receiveMessages(queueName, options = {}) {
        try {
            const queueUrl = this.queues[queueName];
            if (!queueUrl) {
                throw new Error(`Queue ${queueName} not found`);
            }

            const command = new ReceiveMessageCommand({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: options.maxMessages || 1,
                WaitTimeSeconds: options.waitTime || 20,
                VisibilityTimeout: options.visibilityTimeout || 20,
                MessageAttributeNames: ['All']
            });

            const response = await this.client.send(command);
            return response.Messages || [];
        } catch (error) {
            console.error(`❌ Error receiving messages from ${queueName}:`, error);
            throw error;
        }
    }

    // Delete message from queue
    async deleteMessage(queueName, receiptHandle) {
        try {
            const queueUrl = this.queues[queueName];
            if (!queueUrl) {
                throw new Error(`Queue ${queueName} not found`);
            }

            const command = new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: receiptHandle
            });

            const response = await this.client.send(command);
            console.log(`✅ Message deleted from ${queueName}`);
            return response;
        } catch (error) {
            console.error(`❌ Error deleting message from ${queueName}:`, error);
            throw error;
        }
    }

    // Process messages with callback
    async processMessages(queueName, processor, options = {}) {
        try {
            const messages = await this.receiveMessages(queueName, options);
            
            if (!messages || messages.length === 0) {
                console.log(`📭 No messages in ${queueName}`);
                return [];
            }

            const results = [];
            for (const message of messages) {
                try {
                    console.log(`🔄 Processing message from ${queueName}:`, message.MessageId);
                    
                    // Parse message body
                    let messageBody;
                    try {
                        messageBody = JSON.parse(message.Body);
                    } catch {
                        messageBody = message.Body;
                    }

                    // Process message
                    const result = await processor(messageBody, message);
                    results.push({ messageId: message.MessageId, result });

                    // Delete message after successful processing
                    await this.deleteMessage(queueName, message.ReceiptHandle);
                    console.log(`✅ Message processed and deleted:`, message.MessageId);

                } catch (error) {
                    console.error(`❌ Error processing message ${message.MessageId}:`, error);
                    // Message will remain in queue for retry
                }
            }

            return results;
        } catch (error) {
            console.error(`❌ Error processing messages from ${queueName}:`, error);
            throw error;
        }
    }

    // Start long polling for messages
    async startPolling(queueName, processor, options = {}) {
        console.log(`🔄 Starting polling for ${queueName}...`);
        
        const pollOptions = {
            maxMessages: options.maxMessages || 1,
            waitTime: options.waitTime || 20,
            visibilityTimeout: options.visibilityTimeout || 20,
            pollInterval: options.pollInterval || 1000
        };

        const poll = async () => {
            try {
                await this.processMessages(queueName, processor, pollOptions);
            } catch (error) {
                console.error(`❌ Polling error for ${queueName}:`, error);
            }

            // Continue polling
            setTimeout(poll, pollOptions.pollInterval);
        };

        // Start polling
        poll();
    }

    // Get queue attributes
    async getQueueAttributes(queueName) {
        try {
            const queueUrl = this.queues[queueName];
            if (!queueUrl) {
                console.warn(`⚠️ Queue ${queueName} not configured`);
                return {
                    ApproximateNumberOfMessages: 0,
                    ApproximateNumberOfMessagesNotVisible: 0,
                    ApproximateNumberOfMessagesDelayed: 0,
                    QueueArn: null,
                    CreatedTimestamp: null,
                    LastModifiedTimestamp: null
                };
            }

            const command = new GetQueueAttributesCommand({
                QueueUrl: queueUrl,
                AttributeNames: ['All']
            });

            const response = await this.client.send(command);
            return response.Attributes;
        } catch (error) {
            if (error.name === 'QueueDoesNotExist') {
                console.warn(`⚠️ Queue ${queueName} does not exist in AWS`);
                return {
                    ApproximateNumberOfMessages: 0,
                    ApproximateNumberOfMessagesNotVisible: 0,
                    ApproximateNumberOfMessagesDelayed: 0,
                    QueueArn: null,
                    CreatedTimestamp: null,
                    LastModifiedTimestamp: null,
                    Status: 'NOT_EXISTS'
                };
            }
            console.error(`❌ Error getting queue attributes for ${queueName}:`, error);
            throw error;
        }
    }
}

module.exports = SQSService;
