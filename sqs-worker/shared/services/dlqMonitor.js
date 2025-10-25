const EnhancedSQSService = require('./enhancedSqsService');

/**
 * DLQ Monitor Service
 * Monitors Dead Letter Queues and provides alerting and recovery mechanisms
 */
class DLQMonitor {
    constructor() {
        this.sqs = new EnhancedSQSService();
        this.queues = ['transcoding', 'upload', 'storage', 'notifications'];
        this.monitoringInterval = 60000; // 1 minute
        this.isMonitoring = false;
    }

    /**
     * Start monitoring all DLQs
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️ DLQ monitoring is already running');
            return;
        }

        console.log('🚀 Starting DLQ monitoring...');
        this.isMonitoring = true;

        // Initial check
        await this.checkAllDLQs();

        // Set up interval monitoring
        this.monitoringIntervalId = setInterval(async () => {
            try {
                await this.checkAllDLQs();
            } catch (error) {
                console.error('❌ Error during DLQ monitoring:', error);
            }
        }, this.monitoringInterval);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringIntervalId) {
            clearInterval(this.monitoringIntervalId);
            this.monitoringIntervalId = null;
        }
        this.isMonitoring = false;
        console.log('🛑 DLQ monitoring stopped');
    }

    /**
     * Check all DLQs for failed messages
     */
    async checkAllDLQs() {
        console.log('🔍 Checking all DLQs...');
        
        const results = {};
        let totalFailedMessages = 0;

        for (const queueName of this.queues) {
            try {
                const dlqMessages = await this.sqs.monitorDLQ(queueName);
                results[queueName] = dlqMessages;
                totalFailedMessages += dlqMessages.length;

                if (dlqMessages.length > 0) {
                    console.log(`🚨 ${dlqMessages.length} failed messages in ${queueName}-dlq`);
                }
            } catch (error) {
                console.error(`❌ Error checking DLQ for ${queueName}:`, error);
                results[queueName] = { error: error.message };
            }
        }

        // Send alert if there are failed messages
        if (totalFailedMessages > 0) {
            await this.sendAlert(totalFailedMessages, results);
        }

        return results;
    }

    /**
     * Send alert for DLQ messages
     */
    async sendAlert(totalFailedMessages, results) {
        const alertMessage = {
            timestamp: new Date().toISOString(),
            totalFailedMessages,
            details: results,
            severity: totalFailedMessages > 10 ? 'HIGH' : 'MEDIUM'
        };

        console.log('🚨 DLQ ALERT:', alertMessage);

        // Here you could integrate with SNS, Slack, email, etc.
        // For now, we'll just log the alert
        console.log('📧 Alert would be sent to administrators');
        console.log('📊 Alert details:', JSON.stringify(alertMessage, null, 2));
    }

    /**
     * Get comprehensive DLQ statistics
     */
    async getDLQStatistics() {
        const stats = {};
        
        for (const queueName of this.queues) {
            try {
                const queueStats = await this.sqs.getQueueStats(queueName);
                const dlqMessages = await this.sqs.getDLQMessages(queueName);
                
                stats[queueName] = {
                    ...queueStats,
                    dlqMessageCount: dlqMessages.length,
                    dlqMessages: dlqMessages.map(msg => ({
                        messageId: msg.MessageId,
                        timestamp: msg.Attributes?.SentTimestamp,
                        retryCount: msg.MessageAttributes?.RetryCount?.StringValue || '0',
                        errorType: msg.MessageAttributes?.ErrorType?.StringValue || 'unknown'
                    }))
                };
            } catch (error) {
                stats[queueName] = { error: error.message };
            }
        }

        return stats;
    }

    /**
     * Analyze error patterns in DLQ
     */
    async analyzeErrorPatterns() {
        const analysis = {};
        
        for (const queueName of this.queues) {
            try {
                const dlqMessages = await this.sqs.getDLQMessages(queueName);
                
                const errorTypes = {};
                const retryCounts = {};
                
                dlqMessages.forEach(msg => {
                    const errorType = msg.MessageAttributes?.ErrorType?.StringValue || 'unknown';
                    const retryCount = msg.MessageAttributes?.RetryCount?.StringValue || '0';
                    
                    errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
                    retryCounts[retryCount] = (retryCounts[retryCount] || 0) + 1;
                });
                
                analysis[queueName] = {
                    totalMessages: dlqMessages.length,
                    errorTypes,
                    retryCounts,
                    mostCommonError: Object.keys(errorTypes).reduce((a, b) => 
                        errorTypes[a] > errorTypes[b] ? a : b, 'none'
                    )
                };
            } catch (error) {
                analysis[queueName] = { error: error.message };
            }
        }

        return analysis;
    }

    /**
     * Manual recovery of DLQ messages
     */
    async recoverDLQMessages(queueName, options = {}) {
        try {
            console.log(`🔄 Starting recovery for ${queueName} DLQ...`);
            
            const dlqMessages = await this.sqs.getDLQMessages(queueName);
            const maxRecovery = options.maxRecovery || 10;
            const recoveredMessages = [];
            
            for (let i = 0; i < Math.min(dlqMessages.length, maxRecovery); i++) {
                const message = dlqMessages[i];
                
                try {
                    // Check if message should be recovered
                    const errorType = message.MessageAttributes?.ErrorType?.StringValue || 'unknown';
                    
                    if (options.onlyTransient && errorType !== 'transient') {
                        console.log(`⏭️ Skipping ${errorType} error message:`, message.MessageId);
                        continue;
                    }
                    
                    // Reprocess message
                    await this.sqs.reprocessDLQMessage(queueName, message, {
                        delaySeconds: options.delaySeconds || 0
                    });
                    
                    recoveredMessages.push(message.MessageId);
                    console.log(`✅ Recovered message:`, message.MessageId);
                    
                } catch (error) {
                    console.error(`❌ Failed to recover message ${message.MessageId}:`, error);
                }
            }
            
            console.log(`🎉 Recovery completed: ${recoveredMessages.length} messages recovered`);
            return recoveredMessages;
            
        } catch (error) {
            console.error(`❌ Error during DLQ recovery for ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Clean up old DLQ messages
     */
    async cleanupDLQMessages(queueName, options = {}) {
        try {
            console.log(`🧹 Starting cleanup for ${queueName} DLQ...`);
            
            const dlqMessages = await this.sqs.getDLQMessages(queueName);
            const maxAge = options.maxAge || 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            const currentTime = Date.now();
            const cleanedMessages = [];
            
            for (const message of dlqMessages) {
                const messageTime = parseInt(message.Attributes?.SentTimestamp || '0');
                const age = currentTime - messageTime;
                
                if (age > maxAge) {
                    try {
                        // Delete old message from DLQ
                        const dlqUrl = this.sqs.dlqQueues[queueName];
                        const deleteCommand = new SQS.DeleteMessageCommand({
                            QueueUrl: dlqUrl,
                            ReceiptHandle: message.ReceiptHandle
                        });
                        await this.sqs.client.send(deleteCommand);
                        
                        cleanedMessages.push(message.MessageId);
                        console.log(`🗑️ Cleaned up old message:`, message.MessageId);
                        
                    } catch (error) {
                        console.error(`❌ Failed to clean up message ${message.MessageId}:`, error);
                    }
                }
            }
            
            console.log(`🧹 Cleanup completed: ${cleanedMessages.length} old messages removed`);
            return cleanedMessages;
            
        } catch (error) {
            console.error(`❌ Error during DLQ cleanup for ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Generate DLQ report
     */
    async generateReport() {
        try {
            console.log('📊 Generating DLQ report...');
            
            const stats = await this.getDLQStatistics();
            const analysis = await this.analyzeErrorPatterns();
            
            const report = {
                timestamp: new Date().toISOString(),
                summary: {
                    totalQueues: this.queues.length,
                    totalFailedMessages: Object.values(stats).reduce((sum, queue) => 
                        sum + (queue.dlqMessageCount || 0), 0
                    )
                },
                statistics: stats,
                analysis: analysis,
                recommendations: this.generateRecommendations(analysis)
            };
            
            console.log('📋 DLQ Report Generated:');
            console.log(JSON.stringify(report, null, 2));
            
            return report;
            
        } catch (error) {
            console.error('❌ Error generating DLQ report:', error);
            throw error;
        }
    }

    /**
     * Generate recommendations based on error analysis
     */
    generateRecommendations(analysis) {
        const recommendations = [];
        
        for (const [queueName, data] of Object.entries(analysis)) {
            if (data.error) continue;
            
            if (data.totalMessages > 5) {
                recommendations.push({
                    queue: queueName,
                    issue: 'High failure rate',
                    recommendation: 'Investigate and fix underlying issues'
                });
            }
            
            if (data.mostCommonError === 'transient') {
                recommendations.push({
                    queue: queueName,
                    issue: 'Transient errors',
                    recommendation: 'Implement better retry logic with exponential backoff'
                });
            }
            
            if (data.mostCommonError === 'config') {
                recommendations.push({
                    queue: queueName,
                    issue: 'Configuration errors',
                    recommendation: 'Review and fix service configuration'
                });
            }
        }
        
        return recommendations;
    }
}

module.exports = DLQMonitor;
