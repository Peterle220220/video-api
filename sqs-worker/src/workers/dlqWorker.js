const EnhancedSQSService = require('../../shared/services/enhancedSqsService');
const DLQMonitor = require('../../shared/services/dlqMonitor');

/**
 * DLQ Worker - Handles messages from Dead Letter Queues
 * This worker processes failed messages and provides recovery mechanisms
 */
class DLQWorker {
    constructor() {
        this.sqs = new EnhancedSQSService();
        this.monitor = new DLQMonitor();
        this.queues = ['transcoding', 'upload', 'storage', 'notifications'];
    }

    /**
     * Start processing DLQ messages
     */
    async startDLQProcessing() {
        console.log('🚀 Starting DLQ processing...');
        
        // Start monitoring
        await this.monitor.startMonitoring();
        
        // Process each DLQ
        for (const queueName of this.queues) {
            this.processDLQQueue(queueName);
        }
    }

    /**
     * Process messages from a specific DLQ
     */
    async processDLQQueue(queueName) {
        console.log(`🔄 Processing DLQ for ${queueName}...`);
        
        try {
            const dlqMessages = await this.sqs.getDLQMessages(queueName);
            
            if (dlqMessages.length === 0) {
                console.log(`📭 No messages in ${queueName}-dlq`);
                return;
            }

            console.log(`📋 Found ${dlqMessages.length} failed messages in ${queueName}-dlq`);
            
            for (const message of dlqMessages) {
                await this.processDLQMessage(queueName, message);
            }
            
        } catch (error) {
            console.error(`❌ Error processing DLQ for ${queueName}:`, error);
        }
    }

    /**
     * Process individual DLQ message
     */
    async processDLQMessage(queueName, message) {
        try {
            console.log(`🔍 Processing DLQ message:`, message.MessageId);
            
            // Parse message body
            let messageBody;
            try {
                messageBody = JSON.parse(message.Body);
            } catch {
                messageBody = message.Body;
            }

            // Get error information
            const errorType = message.MessageAttributes?.ErrorType?.StringValue || 'unknown';
            const retryCount = message.MessageAttributes?.RetryCount?.StringValue || '0';
            const timestamp = message.Attributes?.SentTimestamp || Date.now().toString();

            console.log(`📊 Message details:`, {
                messageId: message.MessageId,
                errorType,
                retryCount,
                timestamp: new Date(parseInt(timestamp)).toISOString()
            });

            // Analyze the failure
            const analysis = await this.analyzeFailure(queueName, messageBody, errorType);
            console.log(`🔍 Failure analysis:`, analysis);

            // Determine recovery strategy
            const recoveryStrategy = this.determineRecoveryStrategy(analysis);
            console.log(`🎯 Recovery strategy:`, recoveryStrategy);

            // Execute recovery
            await this.executeRecovery(queueName, message, recoveryStrategy);

        } catch (error) {
            console.error(`❌ Error processing DLQ message ${message.MessageId}:`, error);
        }
    }

    /**
     * Analyze failure to determine cause
     */
    async analyzeFailure(queueName, messageBody, errorType) {
        const analysis = {
            queueName,
            errorType,
            timestamp: new Date().toISOString(),
            recommendations: []
        };

        // Analyze based on error type
        switch (errorType) {
            case 'transient':
                analysis.recommendations.push('Retry with exponential backoff');
                analysis.recommendations.push('Check network connectivity');
                break;
                
            case 'config':
                analysis.recommendations.push('Review service configuration');
                analysis.recommendations.push('Check AWS permissions');
                break;
                
            case 'resource':
                analysis.recommendations.push('Increase resource allocation');
                analysis.recommendations.push('Check disk space and memory');
                break;
                
            case 'permanent':
                analysis.recommendations.push('Manual intervention required');
                analysis.recommendations.push('Review message data integrity');
                break;
                
            default:
                analysis.recommendations.push('Unknown error type - manual review needed');
        }

        // Analyze message content
        if (messageBody.videoId) {
            analysis.videoId = messageBody.videoId;
        }
        
        if (messageBody.s3Key) {
            analysis.s3Key = messageBody.s3Key;
        }

        return analysis;
    }

    /**
     * Determine recovery strategy based on analysis
     */
    determineRecoveryStrategy(analysis) {
        const strategy = {
            action: 'manual_review',
            reason: 'Unknown error type',
            confidence: 'low'
        };

        switch (analysis.errorType) {
            case 'transient':
                strategy.action = 'auto_retry';
                strategy.reason = 'Transient error - safe to retry';
                strategy.confidence = 'high';
                break;
                
            case 'config':
                strategy.action = 'manual_fix';
                strategy.reason = 'Configuration error - needs manual intervention';
                strategy.confidence = 'high';
                break;
                
            case 'resource':
                strategy.action = 'manual_review';
                strategy.reason = 'Resource error - check system resources';
                strategy.confidence = 'medium';
                break;
                
            case 'permanent':
                strategy.action = 'skip';
                strategy.reason = 'Permanent error - cannot be recovered';
                strategy.confidence = 'high';
                break;
                
            default:
                strategy.action = 'manual_review';
                strategy.reason = 'Unknown error - needs manual review';
                strategy.confidence = 'low';
        }

        return strategy;
    }

    /**
     * Execute recovery strategy
     */
    async executeRecovery(queueName, message, strategy) {
        try {
            console.log(`🎯 Executing recovery strategy: ${strategy.action}`);
            
            switch (strategy.action) {
                case 'auto_retry':
                    await this.autoRetry(queueName, message);
                    break;
                    
                case 'manual_fix':
                    await this.flagForManualReview(queueName, message, strategy);
                    break;
                    
                case 'skip':
                    await this.skipMessage(queueName, message, strategy);
                    break;
                    
                case 'manual_review':
                default:
                    await this.flagForManualReview(queueName, message, strategy);
                    break;
            }
            
        } catch (error) {
            console.error(`❌ Error executing recovery strategy:`, error);
        }
    }

    /**
     * Auto retry message
     */
    async autoRetry(queueName, message) {
        try {
            console.log(`🔄 Auto-retrying message:`, message.MessageId);
            
            // Reprocess message with reset retry count
            await this.sqs.reprocessDLQMessage(queueName, message, {
                delaySeconds: 60, // 1 minute delay
                retryCount: 0,
                errorType: 'reprocessed'
            });
            
            console.log(`✅ Message auto-retried:`, message.MessageId);
            
        } catch (error) {
            console.error(`❌ Error auto-retrying message:`, error);
        }
    }

    /**
     * Flag message for manual review
     */
    async flagForManualReview(queueName, message, strategy) {
        try {
            console.log(`🏷️ Flagging message for manual review:`, message.MessageId);
            
            // Log detailed information for manual review
            const reviewInfo = {
                messageId: message.MessageId,
                queueName,
                strategy,
                timestamp: new Date().toISOString(),
                messageBody: message.Body,
                attributes: message.MessageAttributes
            };
            
            console.log(`📋 Manual review required:`, JSON.stringify(reviewInfo, null, 2));
            
            // Here you could send to a notification system, database, etc.
            // For now, we'll just log it
            
        } catch (error) {
            console.error(`❌ Error flagging message for review:`, error);
        }
    }

    /**
     * Skip message (permanent failure)
     */
    async skipMessage(queueName, message, strategy) {
        try {
            console.log(`⏭️ Skipping permanently failed message:`, message.MessageId);
            
            // Log the skip reason
            console.log(`📝 Skip reason: ${strategy.reason}`);
            
            // Delete message from DLQ (it's permanently failed)
            const dlqUrl = this.sqs.dlqQueues[queueName];
            const deleteCommand = new SQS.DeleteMessageCommand({
                QueueUrl: dlqUrl,
                ReceiptHandle: message.ReceiptHandle
            });
            await this.sqs.client.send(deleteCommand);
            
            console.log(`🗑️ Permanently failed message removed:`, message.MessageId);
            
        } catch (error) {
            console.error(`❌ Error skipping message:`, error);
        }
    }

    /**
     * Generate DLQ report
     */
    async generateReport() {
        try {
            console.log('📊 Generating DLQ report...');
            
            const report = await this.monitor.generateReport();
            
            console.log('📋 DLQ Report:');
            console.log(JSON.stringify(report, null, 2));
            
            return report;
            
        } catch (error) {
            console.error('❌ Error generating DLQ report:', error);
            throw error;
        }
    }

    /**
     * Manual recovery of specific messages
     */
    async manualRecovery(queueName, options = {}) {
        try {
            console.log(`🔄 Starting manual recovery for ${queueName}...`);
            
            const recoveredMessages = await this.monitor.recoverDLQMessages(queueName, options);
            
            console.log(`🎉 Manual recovery completed: ${recoveredMessages.length} messages recovered`);
            return recoveredMessages;
            
        } catch (error) {
            console.error(`❌ Error during manual recovery:`, error);
            throw error;
        }
    }

    /**
     * Clean up old DLQ messages
     */
    async cleanupOldMessages(queueName, options = {}) {
        try {
            console.log(`🧹 Starting cleanup for ${queueName}...`);
            
            const cleanedMessages = await this.monitor.cleanupDLQMessages(queueName, options);
            
            console.log(`🧹 Cleanup completed: ${cleanedMessages.length} old messages removed`);
            return cleanedMessages;
            
        } catch (error) {
            console.error(`❌ Error during cleanup:`, error);
            throw error;
        }
    }
}

module.exports = DLQWorker;
