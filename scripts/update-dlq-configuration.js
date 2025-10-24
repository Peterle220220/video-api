#!/usr/bin/env node

/**
 * Update DLQ Configuration for Existing SQS Queues
 * This script safely updates existing queues to use the new DLQ queues
 */

const { SQSClient, SetQueueAttributesCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

class DLQConfigurationUpdater {
    constructor(region = 'ap-southeast-2') {
        this.client = new SQSClient({ region });
        this.region = region;
    }

    /**
     * Check current DLQ configuration for a queue
     */
    async checkCurrentConfiguration(queueName) {
        try {
            const command = new GetQueueAttributesCommand({
                QueueUrl: `https://sqs.${this.region}.amazonaws.com/901444280953/${queueName}`,
                AttributeNames: ['RedrivePolicy']
            });

            const result = await this.client.send(command);
            return result.Attributes.RedrivePolicy;
        } catch (error) {
            console.error(`❌ Error checking configuration for ${queueName}:`, error);
            return null;
        }
    }

    /**
     * Update DLQ configuration for a queue
     */
    async updateDLQConfiguration(queueName, newDLQArn) {
        try {
            console.log(`🔧 Updating DLQ configuration for ${queueName}...`);
            
            const redrivePolicy = {
                deadLetterTargetArn: newDLQArn,
                maxReceiveCount: 3
            };

            const command = new SetQueueAttributesCommand({
                QueueUrl: `https://sqs.${this.region}.amazonaws.com/901444280953/${queueName}`,
                Attributes: {
                    RedrivePolicy: JSON.stringify(redrivePolicy)
                }
            });

            await this.client.send(command);
            console.log(`✅ DLQ configuration updated for ${queueName}`);
            console.log(`   New DLQ: ${newDLQArn}`);
            
            return true;
        } catch (error) {
            console.error(`❌ Error updating DLQ configuration for ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Check all queue configurations
     */
    async checkAllConfigurations() {
        console.log('🔍 Checking current DLQ configurations...\n');
        
        const queues = [
            'transcoding-queue',
            'upload-queue', 
            'storage-queue',
            'notifications-queue'
        ];

        for (const queueName of queues) {
            try {
                const currentPolicy = await this.checkCurrentConfiguration(queueName);
                
                console.log(`📊 ${queueName}:`);
                if (currentPolicy) {
                    const policy = JSON.parse(currentPolicy);
                    console.log(`   Current DLQ: ${policy.deadLetterTargetArn}`);
                    console.log(`   Max Receive Count: ${policy.maxReceiveCount}`);
                } else {
                    console.log(`   No redrive policy configured`);
                }
                console.log('');
                
            } catch (error) {
                console.error(`❌ Error checking ${queueName}:`, error.message);
            }
        }
    }

    /**
     * Update all queue configurations to use new DLQs
     */
    async updateAllConfigurations() {
        console.log('🚀 Updating all queue DLQ configurations...\n');
        
        const queueConfigs = [
            {
                mainQueue: 'transcoding-queue',
                newDLQArn: 'arn:aws:sqs:ap-southeast-2:901444280953:transcoding-dlq'
            },
            {
                mainQueue: 'upload-queue',
                newDLQArn: 'arn:aws:sqs:ap-southeast-2:901444280953:upload-dlq'
            },
            {
                mainQueue: 'storage-queue',
                newDLQArn: 'arn:aws:sqs:ap-southeast-2:901444280953:storage-dlq'
            },
            {
                mainQueue: 'notifications-queue',
                newDLQArn: 'arn:aws:sqs:ap-southeast-2:901444280953:notifications-dlq'
            }
        ];

        for (const config of queueConfigs) {
            try {
                console.log(`🔄 Updating ${config.mainQueue}...`);
                
                // Check current configuration
                const currentPolicy = await this.checkCurrentConfiguration(config.mainQueue);
                if (currentPolicy) {
                    const policy = JSON.parse(currentPolicy);
                    console.log(`   Current DLQ: ${policy.deadLetterTargetArn}`);
                }
                
                // Update to new DLQ
                await this.updateDLQConfiguration(config.mainQueue, config.newDLQArn);
                
                console.log(`✅ ${config.mainQueue} updated successfully\n`);
                
            } catch (error) {
                console.error(`❌ Failed to update ${config.mainQueue}:`, error.message);
                console.log('');
            }
        }

        console.log('🎉 DLQ configuration update completed!');
    }

    /**
     * Verify all configurations
     */
    async verifyAllConfigurations() {
        console.log('🔍 Verifying all DLQ configurations...\n');
        
        const expectedConfigs = {
            'transcoding-queue': 'arn:aws:sqs:ap-southeast-2:901444280953:transcoding-dlq',
            'upload-queue': 'arn:aws:sqs:ap-southeast-2:901444280953:upload-dlq',
            'storage-queue': 'arn:aws:sqs:ap-southeast-2:901444280953:storage-dlq',
            'notifications-queue': 'arn:aws:sqs:ap-southeast-2:901444280953:notifications-dlq'
        };

        let allCorrect = true;

        for (const [queueName, expectedDLQ] of Object.entries(expectedConfigs)) {
            try {
                const currentPolicy = await this.checkCurrentConfiguration(queueName);
                
                if (currentPolicy) {
                    const policy = JSON.parse(currentPolicy);
                    const isCorrect = policy.deadLetterTargetArn === expectedDLQ;
                    
                    console.log(`📊 ${queueName}:`);
                    console.log(`   Current DLQ: ${policy.deadLetterTargetArn}`);
                    console.log(`   Expected DLQ: ${expectedDLQ}`);
                    console.log(`   Status: ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
                    
                    if (!isCorrect) {
                        allCorrect = false;
                    }
                } else {
                    console.log(`📊 ${queueName}: No redrive policy configured ❌`);
                    allCorrect = false;
                }
                console.log('');
                
            } catch (error) {
                console.error(`❌ Error verifying ${queueName}:`, error.message);
                allCorrect = false;
            }
        }

        if (allCorrect) {
            console.log('🎉 All DLQ configurations are correct!');
        } else {
            console.log('⚠️  Some DLQ configurations need to be updated.');
        }

        return allCorrect;
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log('\n📋 DLQ Configuration Updater');
        console.log('='.repeat(50));
        console.log('Usage: node scripts/update-dlq-configuration.js <command>');
        console.log('\nCommands:');
        console.log('  check       Check current DLQ configurations');
        console.log('  update      Update all queues to use new DLQs');
        console.log('  verify      Verify all configurations are correct');
        console.log('  help        Show this help message');
        console.log('\nExamples:');
        console.log('  node scripts/update-dlq-configuration.js check');
        console.log('  node scripts/update-dlq-configuration.js update');
        console.log('  node scripts/update-dlq-configuration.js verify');
        console.log('\nThis script will:');
        console.log('  1. Check current DLQ configurations');
        console.log('  2. Update queues to use new DLQ queues');
        console.log('  3. Verify configurations are correct');
    }
}

// Main execution
async function main() {
    const command = process.argv[2];
    const updater = new DLQConfigurationUpdater();

    try {
        switch (command) {
            case 'check':
                await updater.checkAllConfigurations();
                break;
                
            case 'update':
                console.log('⚠️  This will update DLQ configurations for all queues.');
                console.log('⚠️  Make sure new DLQ queues have been created first.');
                console.log('');
                await updater.updateAllConfigurations();
                break;
                
            case 'verify':
                await updater.verifyAllConfigurations();
                break;
                
            case 'help':
            default:
                updater.showHelp();
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

module.exports = DLQConfigurationUpdater;
