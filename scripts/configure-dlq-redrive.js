#!/usr/bin/env node

/**
 * Configure DLQ Redrive Policies for Existing SQS Queues
 * This script safely configures existing queues to use DLQ without affecting other projects
 */

const { SQSClient, SetQueueAttributesCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

class DLQRedriveConfigurator {
    constructor(region = 'ap-southeast-2') {
        this.client = new SQSClient({ region });
        this.region = region;
    }

    /**
     * Configure redrive policy for a queue
     */
    async configureRedrivePolicy(queueName, dlqArn, maxReceiveCount = 3) {
        try {
            console.log(`🔧 Configuring redrive policy for ${queueName}...`);
            
            const redrivePolicy = {
                deadLetterTargetArn: dlqArn,
                maxReceiveCount: maxReceiveCount
            };

            const command = new SetQueueAttributesCommand({
                QueueUrl: `https://sqs.${this.region}.amazonaws.com/901444280953/${queueName}`,
                Attributes: {
                    RedrivePolicy: JSON.stringify(redrivePolicy)
                }
            });

            await this.client.send(command);
            console.log(`✅ Redrive policy configured for ${queueName}`);
            
            return true;
        } catch (error) {
            console.error(`❌ Error configuring redrive policy for ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Check current queue configuration
     */
    async checkQueueConfiguration(queueName) {
        try {
            const command = new GetQueueAttributesCommand({
                QueueUrl: `https://sqs.${this.region}.amazonaws.com/901444280953/${queueName}`,
                AttributeNames: ['RedrivePolicy', 'VisibilityTimeout', 'MessageRetentionPeriod']
            });

            const result = await this.client.send(command);
            return result.Attributes;
        } catch (error) {
            console.error(`❌ Error checking queue configuration for ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Configure all main queues with their respective DLQs
     */
    async configureAllQueues() {
        const queueConfigs = [
            {
                mainQueue: 'transcoding-queue',
                dlqName: 'transcoding-dlq',
                dlqArn: 'arn:aws:sqs:ap-southeast-2:901444280953:transcoding-dlq'
            },
            {
                mainQueue: 'upload-queue',
                dlqName: 'upload-dlq',
                dlqArn: 'arn:aws:sqs:ap-southeast-2:901444280953:upload-dlq'
            },
            {
                mainQueue: 'storage-queue',
                dlqName: 'storage-dlq',
                dlqArn: 'arn:aws:sqs:ap-southeast-2:901444280953:storage-dlq'
            },
            {
                mainQueue: 'notifications-queue',
                dlqName: 'notifications-dlq',
                dlqArn: 'arn:aws:sqs:ap-southeast-2:901444280953:notifications-dlq'
            }
        ];

        console.log('🚀 Starting DLQ redrive policy configuration...');
        console.log('⚠️  This will configure existing queues to use DLQ redrive policies');
        console.log('⚠️  Make sure DLQ queues have been created first via Terraform');
        
        for (const config of queueConfigs) {
            try {
                // Check current configuration
                console.log(`\n📋 Checking current configuration for ${config.mainQueue}...`);
                const currentConfig = await this.checkQueueConfiguration(config.mainQueue);
                
                if (currentConfig.RedrivePolicy) {
                    console.log(`⚠️  ${config.mainQueue} already has a redrive policy:`, currentConfig.RedrivePolicy);
                    console.log(`⏭️  Skipping ${config.mainQueue} to avoid conflicts`);
                    continue;
                }

                // Configure redrive policy
                await this.configureRedrivePolicy(config.mainQueue, config.dlqArn);
                
            } catch (error) {
                console.error(`❌ Failed to configure ${config.mainQueue}:`, error.message);
                // Continue with other queues
            }
        }

        console.log('\n🎉 DLQ redrive policy configuration completed!');
    }

    /**
     * Verify DLQ configuration
     */
    async verifyConfiguration() {
        console.log('🔍 Verifying DLQ configuration...');
        
        const queues = ['transcoding-queue', 'upload-queue', 'storage-queue', 'notifications-queue'];
        
        for (const queueName of queues) {
            try {
                const config = await this.checkQueueConfiguration(queueName);
                
                console.log(`\n📊 ${queueName}:`);
                console.log(`   Redrive Policy: ${config.RedrivePolicy || 'None'}`);
                console.log(`   Visibility Timeout: ${config.VisibilityTimeout}s`);
                console.log(`   Message Retention: ${config.MessageRetentionPeriod}s`);
                
            } catch (error) {
                console.error(`❌ Error checking ${queueName}:`, error.message);
            }
        }
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log('\n📋 DLQ Redrive Policy Configuration Tool');
        console.log('='.repeat(50));
        console.log('Usage: node scripts/configure-dlq-redrive.js <command>');
        console.log('\nCommands:');
        console.log('  configure    Configure redrive policies for all queues');
        console.log('  verify       Verify current configuration');
        console.log('  help         Show this help message');
        console.log('\nPrerequisites:');
        console.log('  1. DLQ queues must be created first via Terraform');
        console.log('  2. Main queues must exist');
        console.log('  3. AWS credentials must be configured');
        console.log('\nExample:');
        console.log('  node scripts/configure-dlq-redrive.js configure');
        console.log('  node scripts/configure-dlq-redrive.js verify');
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
                
            case 'verify':
                await configurator.verifyConfiguration();
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
