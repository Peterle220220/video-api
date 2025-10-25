#!/usr/bin/env node

/**
 * Configure DLQ Redrive Policy
 * This script configures the redrive policy for all main queues to link them with their DLQs
 */

const { SQSClient, SetQueueAttributesCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

class DLQRedriveConfigurator {
    constructor() {
        this.region = 'ap-southeast-2';
        this.accountId = '901444280953';
        this.client = new SQSClient({ region: this.region });
        
        this.queueConfigs = [
            {
                mainQueue: 'transcoding-queue',
                dlq: 'transcoding-dlq',
                maxReceiveCount: 3
            },
            {
                mainQueue: 'upload-queue',
                dlq: 'upload-dlq',
                maxReceiveCount: 3
            },
            {
                mainQueue: 'storage-queue',
                dlq: 'storage-dlq',
                maxReceiveCount: 3
            },
            {
                mainQueue: 'notifications-queue',
                dlq: 'notifications-dlq',
                maxReceiveCount: 3
            }
        ];
    }

    /**
     * Get queue ARN from queue name
     */
    getQueueArn(queueName) {
        return `arn:aws:sqs:${this.region}:${this.accountId}:${queueName}`;
    }

    /**
     * Get queue URL from queue name
     */
    getQueueUrl(queueName) {
        return `https://sqs.${this.region}.amazonaws.com/${this.accountId}/${queueName}`;
    }

    /**
     * Configure redrive policy for a single queue
     */
    async configureRedrivePolicy(mainQueue, dlqName, maxReceiveCount) {
        try {
            console.log(`\n🔧 Configuring ${mainQueue}...`);
            
            const mainQueueUrl = this.getQueueUrl(mainQueue);
            const dlqArn = this.getQueueArn(dlqName);
            
            // Create redrive policy
            const redrivePolicy = {
                deadLetterTargetArn: dlqArn,
                maxReceiveCount: maxReceiveCount
            };
            
            console.log(`   Main Queue: ${mainQueue}`);
            console.log(`   DLQ: ${dlqName}`);
            console.log(`   Max Receive Count: ${maxReceiveCount}`);
            
            // Set the redrive policy
            const command = new SetQueueAttributesCommand({
                QueueUrl: mainQueueUrl,
                Attributes: {
                    RedrivePolicy: JSON.stringify(redrivePolicy)
                }
            });
            
            await this.client.send(command);
            console.log(`   ✅ Successfully configured redrive policy`);
            
            // Verify the configuration
            await this.verifyConfiguration(mainQueue, dlqName, maxReceiveCount);
            
            return true;
            
        } catch (error) {
            console.error(`   ❌ Error configuring ${mainQueue}:`, error.message);
            return false;
        }
    }

    /**
     * Verify redrive policy configuration
     */
    async verifyConfiguration(mainQueue, expectedDLQ, expectedMaxReceiveCount) {
        try {
            const queueUrl = this.getQueueUrl(mainQueue);
            
            const command = new GetQueueAttributesCommand({
                QueueUrl: queueUrl,
                AttributeNames: ['RedrivePolicy']
            });
            
            const result = await this.client.send(command);
            
            if (result.Attributes?.RedrivePolicy) {
                const policy = JSON.parse(result.Attributes.RedrivePolicy);
                const currentDLQ = policy.deadLetterTargetArn.split(':').pop();
                const currentMaxReceiveCount = policy.maxReceiveCount;
                
                const isCorrect = 
                    currentDLQ === expectedDLQ && 
                    currentMaxReceiveCount === expectedMaxReceiveCount;
                
                if (isCorrect) {
                    console.log(`   ✅ Verification passed`);
                } else {
                    console.log(`   ⚠️  Configuration mismatch:`);
                    console.log(`      Expected DLQ: ${expectedDLQ}, Got: ${currentDLQ}`);
                    console.log(`      Expected MaxReceiveCount: ${expectedMaxReceiveCount}, Got: ${currentMaxReceiveCount}`);
                }
                
                return isCorrect;
            } else {
                console.log(`   ❌ No redrive policy found after configuration`);
                return false;
            }
            
        } catch (error) {
            console.error(`   ❌ Error verifying configuration:`, error.message);
            return false;
        }
    }

    /**
     * Configure all queues
     */
    async configureAllQueues() {
        console.log('🚀 Configuring DLQ Redrive Policies for All Queues');
        console.log('='.repeat(60));
        
        const results = [];
        
        for (const config of this.queueConfigs) {
            const success = await this.configureRedrivePolicy(
                config.mainQueue,
                config.dlq,
                config.maxReceiveCount
            );
            results.push({
                queue: config.mainQueue,
                success
            });
        }
        
        // Summary
        console.log('\n📋 CONFIGURATION SUMMARY');
        console.log('='.repeat(60));
        
        let allSuccess = true;
        for (const result of results) {
            const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
            console.log(`${result.queue}: ${status}`);
            if (!result.success) allSuccess = false;
        }
        
        console.log('\n' + '='.repeat(60));
        if (allSuccess) {
            console.log('🎉 All queues configured successfully!');
            console.log('\n📝 What this means:');
            console.log('   - Messages that fail processing will be retried 3 times');
            console.log('   - After 3 failures, messages will move to DLQ automatically');
            console.log('   - CloudWatch alarms will trigger when messages appear in DLQ');
            console.log('\n🧪 Test it by running:');
            console.log('   node scripts/test-dlq-functionality.js message');
        } else {
            console.log('⚠️  Some queues failed to configure');
            console.log('Please check the errors above and try again');
        }
        
        return results;
    }

    /**
     * Show current configuration
     */
    async showCurrentConfiguration() {
        console.log('📊 Current DLQ Configuration');
        console.log('='.repeat(60));
        
        for (const config of this.queueConfigs) {
            try {
                console.log(`\n🔍 ${config.mainQueue}:`);
                
                const queueUrl = this.getQueueUrl(config.mainQueue);
                const command = new GetQueueAttributesCommand({
                    QueueUrl: queueUrl,
                    AttributeNames: ['RedrivePolicy']
                });
                
                const result = await this.client.send(command);
                
                if (result.Attributes?.RedrivePolicy) {
                    const policy = JSON.parse(result.Attributes.RedrivePolicy);
                    const dlqName = policy.deadLetterTargetArn.split(':').pop();
                    
                    console.log(`   ✅ Redrive Policy: CONFIGURED`);
                    console.log(`   DLQ: ${dlqName}`);
                    console.log(`   Max Receive Count: ${policy.maxReceiveCount}`);
                } else {
                    console.log(`   ❌ Redrive Policy: NOT CONFIGURED`);
                    console.log(`   Expected DLQ: ${config.dlq}`);
                }
                
            } catch (error) {
                console.error(`   ❌ Error: ${error.message}`);
            }
        }
        
        console.log('\n' + '='.repeat(60));
    }

    /**
     * Show help
     */
    showHelp() {
        console.log('\n📋 DLQ Redrive Policy Configurator');
        console.log('='.repeat(60));
        console.log('Usage: node scripts/configure-dlq-redrive.js <command>');
        console.log('\nCommands:');
        console.log('  configure   Configure redrive policies for all queues');
        console.log('  show        Show current redrive policy configuration');
        console.log('  help        Show this help message');
        console.log('\nExamples:');
        console.log('  node scripts/configure-dlq-redrive.js configure');
        console.log('  node scripts/configure-dlq-redrive.js show');
        console.log('\nWhat is a Redrive Policy?');
        console.log('  A redrive policy defines:');
        console.log('  - Which DLQ to send failed messages to');
        console.log('  - How many times to retry before sending to DLQ (maxReceiveCount)');
        console.log('\nDefault Configuration:');
        console.log('  - Max Receive Count: 3 retries');
        console.log('  - DLQ Retention: 14 days');
    }
}

// Main execution
async function main() {
    const command = process.argv[2];
    const configurator = new DLQRedriveConfigurator();

    try {
        switch (command) {
            case 'configure':
                await configurator.configureAllQueues();
                break;
                
            case 'show':
                await configurator.showCurrentConfiguration();
                break;
                
            case 'help':
            default:
                configurator.showHelp();
                break;
        }
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = DLQRedriveConfigurator;
