#!/usr/bin/env node

/**
 * DLQ Management Script
 * Command-line tool for managing Dead Letter Queues
 * 
 * Usage:
 * node scripts/dlq-management.js monitor
 * node scripts/dlq-management.js report
 * node scripts/dlq-management.js recover <queue-name>
 * node scripts/dlq-management.js cleanup <queue-name>
 */

const DLQMonitor = require('../shared/services/dlqMonitor');
const DLQWorker = require('../sqs-worker/src/workers/dlqWorker');

class DLQManagementCLI {
    constructor() {
        this.monitor = new DLQMonitor();
        this.worker = new DLQWorker();
    }

    async run() {
        const command = process.argv[2];
        const queueName = process.argv[3];

        try {
            switch (command) {
                case 'monitor':
                    await this.startMonitoring();
                    break;
                    
                case 'report':
                    await this.generateReport();
                    break;
                    
                case 'recover':
                    if (!queueName) {
                        console.error('❌ Queue name required for recover command');
                        process.exit(1);
                    }
                    await this.recoverMessages(queueName);
                    break;
                    
                case 'cleanup':
                    if (!queueName) {
                        console.error('❌ Queue name required for cleanup command');
                        process.exit(1);
                    }
                    await this.cleanupMessages(queueName);
                    break;
                    
                case 'analyze':
                    await this.analyzeErrorPatterns();
                    break;
                    
                case 'help':
                default:
                    this.showHelp();
                    break;
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
            process.exit(1);
        }
    }

    /**
     * Start monitoring DLQs
     */
    async startMonitoring() {
        console.log('🚀 Starting DLQ monitoring...');
        console.log('Press Ctrl+C to stop monitoring');
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Stopping DLQ monitoring...');
            this.monitor.stopMonitoring();
            process.exit(0);
        });
        
        await this.monitor.startMonitoring();
    }

    /**
     * Generate comprehensive DLQ report
     */
    async generateReport() {
        console.log('📊 Generating DLQ report...');
        
        const report = await this.monitor.generateReport();
        
        console.log('\n📋 DLQ REPORT');
        console.log('='.repeat(50));
        console.log(`📅 Generated: ${report.timestamp}`);
        console.log(`📊 Total Queues: ${report.summary.totalQueues}`);
        console.log(`🚨 Total Failed Messages: ${report.summary.totalFailedMessages}`);
        
        console.log('\n📈 QUEUE STATISTICS');
        console.log('-'.repeat(30));
        for (const [queueName, stats] of Object.entries(report.statistics)) {
            if (stats.error) {
                console.log(`❌ ${queueName}: ${stats.error}`);
                continue;
            }
            
            console.log(`📦 ${queueName}:`);
            console.log(`   Main Queue: ${stats.mainQueue.visible} visible, ${stats.mainQueue.inFlight} in-flight`);
            console.log(`   DLQ: ${stats.dlq.failed} failed messages`);
        }
        
        console.log('\n🔍 ERROR ANALYSIS');
        console.log('-'.repeat(30));
        for (const [queueName, analysis] of Object.entries(report.analysis)) {
            if (analysis.error) {
                console.log(`❌ ${queueName}: ${analysis.error}`);
                continue;
            }
            
            console.log(`📊 ${queueName}:`);
            console.log(`   Total Messages: ${analysis.totalMessages}`);
            console.log(`   Most Common Error: ${analysis.mostCommonError}`);
            console.log(`   Error Types:`, analysis.errorTypes);
        }
        
        if (report.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS');
            console.log('-'.repeat(30));
            report.recommendations.forEach(rec => {
                console.log(`🎯 ${rec.queue}: ${rec.issue}`);
                console.log(`   → ${rec.recommendation}`);
            });
        }
        
        console.log('\n✅ Report generated successfully');
    }

    /**
     * Recover messages from DLQ
     */
    async recoverMessages(queueName) {
        console.log(`🔄 Starting recovery for ${queueName} DLQ...`);
        
        const options = {
            maxRecovery: 10,
            onlyTransient: false,
            delaySeconds: 0
        };
        
        const recoveredMessages = await this.worker.manualRecovery(queueName, options);
        
        console.log(`🎉 Recovery completed: ${recoveredMessages.length} messages recovered`);
        
        if (recoveredMessages.length > 0) {
            console.log('📋 Recovered message IDs:');
            recoveredMessages.forEach(id => console.log(`   - ${id}`));
        }
    }

    /**
     * Cleanup old messages from DLQ
     */
    async cleanupMessages(queueName) {
        console.log(`🧹 Starting cleanup for ${queueName} DLQ...`);
        
        const options = {
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        };
        
        const cleanedMessages = await this.worker.cleanupOldMessages(queueName, options);
        
        console.log(`🧹 Cleanup completed: ${cleanedMessages.length} old messages removed`);
        
        if (cleanedMessages.length > 0) {
            console.log('📋 Cleaned message IDs:');
            cleanedMessages.forEach(id => console.log(`   - ${id}`));
        }
    }

    /**
     * Analyze error patterns
     */
    async analyzeErrorPatterns() {
        console.log('🔍 Analyzing error patterns...');
        
        const analysis = await this.monitor.analyzeErrorPatterns();
        
        console.log('\n📊 ERROR PATTERN ANALYSIS');
        console.log('='.repeat(50));
        
        for (const [queueName, data] of Object.entries(analysis)) {
            if (data.error) {
                console.log(`❌ ${queueName}: ${data.error}`);
                continue;
            }
            
            console.log(`\n📦 ${queueName.toUpperCase()}`);
            console.log(`   Total Messages: ${data.totalMessages}`);
            console.log(`   Most Common Error: ${data.mostCommonError}`);
            
            if (Object.keys(data.errorTypes).length > 0) {
                console.log('   Error Types:');
                for (const [errorType, count] of Object.entries(data.errorTypes)) {
                    console.log(`     - ${errorType}: ${count} messages`);
                }
            }
            
            if (Object.keys(data.retryCounts).length > 0) {
                console.log('   Retry Counts:');
                for (const [retryCount, count] of Object.entries(data.retryCounts)) {
                    console.log(`     - ${retryCount} retries: ${count} messages`);
                }
            }
        }
        
        console.log('\n✅ Error pattern analysis completed');
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log('\n📋 DLQ Management CLI');
        console.log('='.repeat(50));
        console.log('Usage: node scripts/dlq-management.js <command> [options]');
        console.log('\nCommands:');
        console.log('  monitor              Start monitoring all DLQs');
        console.log('  report               Generate comprehensive DLQ report');
        console.log('  recover <queue>      Recover messages from specific DLQ');
        console.log('  cleanup <queue>       Clean up old messages from DLQ');
        console.log('  analyze              Analyze error patterns');
        console.log('  help                 Show this help message');
        console.log('\nExamples:');
        console.log('  node scripts/dlq-management.js monitor');
        console.log('  node scripts/dlq-management.js report');
        console.log('  node scripts/dlq-management.js recover transcoding');
        console.log('  node scripts/dlq-management.js cleanup upload');
        console.log('  node scripts/dlq-management.js analyze');
        console.log('\nAvailable queues: transcoding, upload, storage, notifications');
    }
}

// Run the CLI
if (require.main === module) {
    const cli = new DLQManagementCLI();
    cli.run().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = DLQManagementCLI;
