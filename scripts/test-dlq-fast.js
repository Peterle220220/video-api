#!/usr/bin/env node

/**
 * Fast DLQ Test
 * Temporarily reduces visibility timeout for faster testing
 */

const { SQSClient, SetQueueAttributesCommand, SendMessageCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

class FastDLQTester {
    constructor() {
        this.region = 'ap-southeast-2';
        this.accountId = '901444280953';
        this.client = new SQSClient({ region: this.region });
        this.queueUrl = `https://sqs.${this.region}.amazonaws.com/${this.accountId}/transcoding-queue`;
    }

    async setFastVisibilityTimeout() {
        console.log('⚡ Setting fast visibility timeout (30 seconds)...');
        
        const command = new SetQueueAttributesCommand({
            QueueUrl: this.queueUrl,
            Attributes: {
                VisibilityTimeout: '30'  // 30 seconds for fast testing
            }
        });
        
        await this.client.send(command);
        console.log('✅ Visibility timeout set to 30 seconds');
        console.log('⚠️  Messages will retry every 30 seconds');
    }

    async restoreVisibilityTimeout() {
        console.log('🔄 Restoring original visibility timeout (5 minutes)...');
        
        const command = new SetQueueAttributesCommand({
            QueueUrl: this.queueUrl,
            Attributes: {
                VisibilityTimeout: '300'  // Back to 5 minutes
            }
        });
        
        await this.client.send(command);
        console.log('✅ Visibility timeout restored to 300 seconds (5 minutes)');
    }

    async sendTestMessage() {
        console.log('🧪 Sending test message...');
        
        const testMessage = JSON.stringify({
            test: true,
            shouldFail: true,
            timestamp: new Date().toISOString()
        });
        
        const command = new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: testMessage
        });
        
        const result = await this.client.send(command);
        console.log(`✅ Test message sent: ${result.MessageId}`);
        return result.MessageId;
    }

    async checkQueue() {
        const command = new GetQueueAttributesCommand({
            QueueUrl: this.queueUrl,
            AttributeNames: ['All']
        });
        
        const result = await this.client.send(command);
        return result.Attributes;
    }

    async checkDLQ() {
        const dlqUrl = `https://sqs.${this.region}.amazonaws.com/${this.accountId}/transcoding-dlq`;
        const command = new GetQueueAttributesCommand({
            QueueUrl: dlqUrl,
            AttributeNames: ['ApproximateNumberOfMessages']
        });
        
        const result = await this.client.send(command);
        return parseInt(result.Attributes.ApproximateNumberOfMessages || '0');
    }

    async monitorDLQ() {
        console.log('\n📊 Monitoring DLQ (checking every 30 seconds)...');
        console.log('⏱️  Expected time: ~2-3 minutes (3 retries x 30 seconds)');
        console.log('Press Ctrl+C to stop monitoring\n');
        
        let attempts = 0;
        const maxAttempts = 10; // Monitor for up to 5 minutes
        
        const checkInterval = setInterval(async () => {
            attempts++;
            
            try {
                const queueAttrs = await this.checkQueue();
                const dlqCount = await this.checkDLQ();
                
                const timestamp = new Date().toLocaleTimeString();
                console.log(`[${timestamp}] Queue: ${queueAttrs.ApproximateNumberOfMessages} visible, ${queueAttrs.ApproximateNumberOfMessagesNotVisible} in-flight | DLQ: ${dlqCount} messages`);
                
                if (dlqCount > 0) {
                    console.log('\n🎉 SUCCESS! Message moved to DLQ!');
                    console.log(`✅ DLQ now has ${dlqCount} failed message(s)`);
                    console.log('\n📝 You can now poll the DLQ in AWS Console to see the message');
                    console.log('   Or run: aws sqs receive-message --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-dlq');
                    clearInterval(checkInterval);
                    process.exit(0);
                }
                
                if (attempts >= maxAttempts) {
                    console.log('\n⏱️  Monitoring timeout reached');
                    console.log('Message should be in DLQ soon. Check manually with:');
                    console.log('aws sqs get-queue-attributes --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-dlq --attribute-names ApproximateNumberOfMessages');
                    clearInterval(checkInterval);
                    process.exit(0);
                }
                
            } catch (error) {
                console.error('❌ Error monitoring:', error.message);
            }
        }, 30000); // Check every 30 seconds
        
        // Initial check
        setTimeout(async () => {
            const queueAttrs = await this.checkQueue();
            const dlqCount = await this.checkDLQ();
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] Queue: ${queueAttrs.ApproximateNumberOfMessages} visible, ${queueAttrs.ApproximateNumberOfMessagesNotVisible} in-flight | DLQ: ${dlqCount} messages`);
        }, 1000);
    }

    showHelp() {
        console.log('\n📋 Fast DLQ Tester');
        console.log('='.repeat(60));
        console.log('Usage: node scripts/test-dlq-fast.js <command>');
        console.log('\nCommands:');
        console.log('  fast        Set fast visibility timeout (30s) and send test message');
        console.log('  restore     Restore original visibility timeout (300s)');
        console.log('  send        Send test message only');
        console.log('  monitor     Monitor queue and DLQ status');
        console.log('  help        Show this help message');
        console.log('\nRecommended Flow:');
        console.log('  1. node scripts/test-dlq-fast.js fast');
        console.log('  2. Wait 2-3 minutes for message to move to DLQ');
        console.log('  3. node scripts/test-dlq-fast.js restore (to restore original settings)');
    }
}

// Main execution
async function main() {
    const command = process.argv[2];
    const tester = new FastDLQTester();

    try {
        switch (command) {
            case 'fast':
                await tester.setFastVisibilityTimeout();
                await tester.sendTestMessage();
                console.log('\n📊 Starting monitoring...');
                await tester.monitorDLQ();
                break;
                
            case 'restore':
                await tester.restoreVisibilityTimeout();
                break;
                
            case 'send':
                await tester.sendTestMessage();
                break;
                
            case 'monitor':
                await tester.monitorDLQ();
                break;
                
            case 'help':
            default:
                tester.showHelp();
                break;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = FastDLQTester;

