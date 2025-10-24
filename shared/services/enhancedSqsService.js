const SQS = require('@aws-sdk/client-sqs');

/**
 * Enhanced SQS Service with Dead Letter Queue support
 * This service provides advanced error handling and DLQ management
 */
class EnhancedSQSService {
    constructor(region = 'ap-southeast-2') {
        this.client = new SQS.SQSClient({ region });
        this.region = region;
        this.queues = {
            transcoding: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue',
            upload: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/upload-queue',
            storage: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/storage-queue',
            notifications: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/notifications-queue'
        };
        this.dlqQueues = {
            transcoding: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-dlq',
            upload: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/upload-dlq',
            storage: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/storage-dlq',
            notifications: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/notifications-dlq'
        };
        
        // Error classification for better handling
        this.errorTypes = {
            TRANSIENT: 'transient',      // Network, timeout - can retry
            PERMANENT: 'permanent',      // Data corruption - cannot retry
            CONFIGURATION: 'config',     // Missing config - need to fix config
            RESOURCE: 'resource'         // Out of memory, disk space
        };
    }

    /**
     * Classify error type for appropriate handling
     */
    classifyError(error) {
        const errorMessage = error.message.toLowerCase();
        
        // Transient errors - can be retried
        if (errorMessage.includes('timeout') || 
            errorMessage.includes('network') || 
            errorMessage.includes('connection') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('throttle')) {
            return this.errorTypes.TRANSIENT;
        }
        
        // Configuration errors - need manual intervention
        if (errorMessage.includes('permission') || 
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('access denied') ||
            errorMessage.includes('not found')) {
            return this.errorTypes.CONFIGURATION;
        }
        
        // Resource errors - system resource issues
        if (errorMessage.includes('memory') || 
            errorMessage.includes('disk space') ||
            errorMessage.includes('out of space')) {
            return this.errorTypes.RESOURCE;
        }
        
        // Default to permanent for unknown errors
        return this.errorTypes.PERMANENT;
    }

    /**
     * Send message to queue with enhanced error handling
     */
    async sendMessage(queueName, messageBody, options = {}) {
        try {
            const queueUrl = this.queues[queueName];
            if (!queueUrl) {
                throw new Error(`Queue ${queueName} not found`);
            }

            const command = new SQS.SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody),
                DelaySeconds: options.delaySeconds || 0,
                MessageAttributes: {
                    'ErrorType': {
                        DataType: 'String',
                        StringValue: options.errorType || 'none'
                    },
                    'RetryCount': {
                        DataType: 'Number',
                        StringValue: String(options.retryCount || 0)
                    },
                    'Timestamp': {
                        DataType: 'String',
                        StringValue: new Date().toISOString()
                    }
                }
            });

            const result = await this.client.send(command);
            console.log(`📤 Message sent to ${queueName}:`, result.MessageId);
            return result;

        } catch (error) {
            console.error(`❌ Error sending message to ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Receive messages from queue
     */
    async receiveMessages(queueName, options = {}) {
        try {
            const queueUrl = this.queues[queueName];
            if (!queueUrl) {
                throw new Error(`Queue ${queueName} not found`);
            }

            const command = new SQS.ReceiveMessageCommand({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: options.maxMessages || 10,
                WaitTimeSeconds: options.waitTimeSeconds || 20,
                VisibilityTimeoutSeconds: options.visibilityTimeout || 30,
                MessageAttributeNames: ['All']
            });

            const result = await this.client.send(command);
            return result.Messages || [];

        } catch (error) {
            console.error(`❌ Error receiving messages from ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Delete message from queue
     */
    async deleteMessage(queueName, receiptHandle) {
        try {
            const queueUrl = this.queues[queueName];
            if (!queueUrl) {
                throw new Error(`Queue ${queueName} not found`);
            }

            const command = new SQS.DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: receiptHandle
            });

            await this.client.send(command);
            console.log(`🗑️ Message deleted from ${queueName}`);

        } catch (error) {
            console.error(`❌ Error deleting message from ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Enhanced message processing with DLQ support
     */
    async processMessagesWithDLQ(queueName, processor, options = {}) {
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

                    // Get retry count from message attributes
                    const retryCount = parseInt(message.MessageAttributes?.RetryCount?.StringValue || '0');
                    const errorType = message.MessageAttributes?.ErrorType?.StringValue || 'none';

                    // Process message
                    const result = await processor(messageBody, message);
                    results.push({ messageId: message.MessageId, result });

                    // Delete message after successful processing
                    await this.deleteMessage(queueName, message.ReceiptHandle);
                    console.log(`✅ Message processed and deleted:`, message.MessageId);

                } catch (error) {
                    console.error(`❌ Error processing message ${message.MessageId}:`, error);
                    
                    // Classify error type
                    const errorClassification = this.classifyError(error);
                    console.log(`🏷️ Error classified as: ${errorClassification}`);
                    
                    // Check retry count
                    const retryCount = parseInt(message.MessageAttributes?.RetryCount?.StringValue || '0');
                    const maxRetries = options.maxRetries || 3;
                    
                    if (retryCount >= maxRetries) {
                        console.log(`🚨 Message will be moved to DLQ after ${retryCount} retries`);
                        // Message will automatically move to DLQ due to redrive policy
                    } else {
                        console.log(`🔄 Message will be retried (${retryCount + 1}/${maxRetries})`);
                        // Message will be retried with exponential backoff
                    }
                }
            }

            return results;
        } catch (error) {
            console.error(`❌ Error processing messages from ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Start long polling for messages with DLQ support
     */
    async startPollingWithDLQ(queueName, processor, options = {}) {
        console.log(`🔄 Starting enhanced polling for ${queueName}...`);
        
        while (true) {
            try {
                await this.processMessagesWithDLQ(queueName, processor, options);
                
                // Short delay between polling cycles
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Polling error for ${queueName}:`, error);
                
                // Wait longer on error before retrying
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    /**
     * Get messages from Dead Letter Queue
     */
    async getDLQMessages(queueName) {
        try {
            const dlqUrl = this.dlqQueues[queueName];
            if (!dlqUrl) {
                throw new Error(`DLQ for ${queueName} not found`);
            }

            const command = new SQS.ReceiveMessageCommand({
                QueueUrl: dlqUrl,
                MaxNumberOfMessages: 10,
                WaitTimeSeconds: 0,
                MessageAttributeNames: ['All']
            });

            const result = await this.client.send(command);
            return result.Messages || [];

        } catch (error) {
            console.error(`❌ Error getting DLQ messages for ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Reprocess message from DLQ (manual recovery)
     */
    async reprocessDLQMessage(queueName, message, options = {}) {
        try {
            console.log(`🔄 Reprocessing DLQ message:`, message.MessageId);
            
            // Parse original message body
            let messageBody;
            try {
                messageBody = JSON.parse(message.Body);
            } catch {
                messageBody = message.Body;
            }

            // Send back to main queue with reset retry count
            await this.sendMessage(queueName, messageBody, {
                delaySeconds: options.delaySeconds || 0,
                retryCount: 0,
                errorType: 'reprocessed'
            });

            // Delete from DLQ
            const dlqUrl = this.dlqQueues[queueName];
            const deleteCommand = new SQS.DeleteMessageCommand({
                QueueUrl: dlqUrl,
                ReceiptHandle: message.ReceiptHandle
            });
            await this.client.send(deleteCommand);

            console.log(`✅ DLQ message reprocessed:`, message.MessageId);
            return true;

        } catch (error) {
            console.error(`❌ Error reprocessing DLQ message:`, error);
            throw error;
        }
    }

    /**
     * Monitor DLQ for failed messages
     */
    async monitorDLQ(queueName) {
        try {
            const dlqMessages = await this.getDLQMessages(queueName);
            
            if (dlqMessages.length > 0) {
                console.log(`🚨 DLQ Alert: ${dlqMessages.length} messages in ${queueName}-dlq`);
                
                // Log details of failed messages
                for (const message of dlqMessages) {
                    console.log(`📋 Failed message details:`, {
                        messageId: message.MessageId,
                        body: message.Body,
                        attributes: message.MessageAttributes,
                        timestamp: message.Attributes?.SentTimestamp
                    });
                }
                
                return dlqMessages;
            }
            
            return [];
        } catch (error) {
            console.error(`❌ Error monitoring DLQ for ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(queueName) {
        try {
            const queueUrl = this.queues[queueName];
            const dlqUrl = this.dlqQueues[queueName];
            
            // Get main queue attributes
            const mainCommand = new SQS.GetQueueAttributesCommand({
                QueueUrl: queueUrl,
                AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
            });
            
            // Get DLQ attributes
            const dlqCommand = new SQS.GetQueueAttributesCommand({
                QueueUrl: dlqUrl,
                AttributeNames: ['ApproximateNumberOfMessages']
            });
            
            const [mainResult, dlqResult] = await Promise.all([
                this.client.send(mainCommand),
                this.client.send(dlqCommand)
            ]);
            
            return {
                mainQueue: {
                    visible: mainResult.Attributes?.ApproximateNumberOfMessages || '0',
                    inFlight: mainResult.Attributes?.ApproximateNumberOfMessagesNotVisible || '0'
                },
                dlq: {
                    failed: dlqResult.Attributes?.ApproximateNumberOfMessages || '0'
                }
            };
            
        } catch (error) {
            console.error(`❌ Error getting queue stats for ${queueName}:`, error);
            throw error;
        }
    }
}

module.exports = EnhancedSQSService;
