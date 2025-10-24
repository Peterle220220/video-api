#!/usr/bin/env node

/**
 * Test DLQ Functionality
 * This script tests the Dead Letter Queue implementation
 */

const { execSync } = require('child_process');

class DLQTester {
    constructor() {
        this.region = 'ap-southeast-2';
        this.accountId = '901444280953';
    }

    /**
     * Test DLQ configuration
     */
    async testDLQConfiguration() {
        console.log('🧪 Testing DLQ Configuration...\n');
        
        const queues = [
            'transcoding-queue',
            'upload-queue',
            'storage-queue',
            'notifications-queue'
        ];

        const expectedDLQs = [
            'transcoding-dlq',
            'upload-dlq',
            'storage-dlq',
            'notifications-dlq'
        ];

        let allCorrect = true;

        for (let i = 0; i < queues.length; i++) {
            const queueName = queues[i];
            const expectedDLQ = expectedDLQs[i];
            
            try {
                console.log(`📊 Testing ${queueName}...`);
                
                // Get current redrive policy
                const command = `aws sqs get-queue-attributes --queue-url https://sqs.${this.region}.amazonaws.com/${this.accountId}/${queueName} --attribute-names RedrivePolicy`;
                const result = execSync(command, { encoding: 'utf8' });
                const attributes = JSON.parse(result);
                
                if (attributes.Attributes.RedrivePolicy) {
                    const policy = JSON.parse(attributes.Attributes.RedrivePolicy);
                    const currentDLQ = policy.deadLetterTargetArn.split('/').pop();
                    const isCorrect = currentDLQ === expectedDLQ;
                    
                    console.log(`   Current DLQ: ${currentDLQ}`);
                    console.log(`   Expected DLQ: ${expectedDLQ}`);
                    console.log(`   Status: ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
                    
                    if (!isCorrect) {
                        allCorrect = false;
                    }
                } else {
                    console.log(`   Status: ❌ No redrive policy configured`);
                    allCorrect = false;
                }
                console.log('');
                
            } catch (error) {
                console.error(`❌ Error testing ${queueName}:`, error.message);
                allCorrect = false;
            }
        }

        return allCorrect;
    }

    /**
     * Test DLQ queues exist
     */
    async testDLQQueuesExist() {
        console.log('🧪 Testing DLQ Queues Exist...\n');
        
        const dlqQueues = [
            'transcoding-dlq',
            'upload-dlq',
            'storage-dlq',
            'notifications-dlq'
        ];

        let allExist = true;

        for (const dlqName of dlqQueues) {
            try {
                console.log(`📊 Testing ${dlqName}...`);
                
                const command = `aws sqs list-queues --queue-name-prefix ${dlqName}`;
                const result = execSync(command, { encoding: 'utf8' });
                const queues = JSON.parse(result);
                
                const exists = queues.QueueUrls && queues.QueueUrls.length > 0;
                console.log(`   Status: ${exists ? '✅ Exists' : '❌ Not found'}`);
                
                if (!exists) {
                    allExist = false;
                }
                console.log('');
                
            } catch (error) {
                console.error(`❌ Error testing ${dlqName}:`, error.message);
                allExist = false;
            }
        }

        return allExist;
    }

    /**
     * Test CloudWatch alarms
     */
    async testCloudWatchAlarms() {
        console.log('🧪 Testing CloudWatch Alarms...\n');
        
        try {
            const command = `aws cloudwatch describe-alarms --alarm-names "*dlq*"`;
            const result = execSync(command, { encoding: 'utf8' });
            const alarms = JSON.parse(result);
            
            console.log(`📊 Found ${alarms.MetricAlarms.length} DLQ alarms:`);
            
            for (const alarm of alarms.MetricAlarms) {
                console.log(`   - ${alarm.AlarmName}: ${alarm.StateValue}`);
            }
            console.log('');
            
            return alarms.MetricAlarms.length >= 4; // Should have 4 DLQ alarms
            
        } catch (error) {
            console.error(`❌ Error testing CloudWatch alarms:`, error.message);
            return false;
        }
    }

    /**
     * Send a test message to trigger DLQ
     */
    async sendTestMessage() {
        console.log('🧪 Sending Test Message to Trigger DLQ...\n');
        
        try {
            // Send a message that will fail processing
            const testMessage = JSON.stringify({
                test: true,
                shouldFail: true,
                timestamp: new Date().toISOString()
            });
            
            const command = `aws sqs send-message --queue-url https://sqs.${this.region}.amazonaws.com/${this.accountId}/transcoding-queue --message-body '${testMessage}'`;
            const result = execSync(command, { encoding: 'utf8' });
            const message = JSON.parse(result);
            
            console.log(`✅ Test message sent: ${message.MessageId}`);
            console.log(`   This message should fail processing and move to DLQ after 3 retries`);
            console.log('');
            
            return message.MessageId;
            
        } catch (error) {
            console.error(`❌ Error sending test message:`, error.message);
            return null;
        }
    }

    /**
     * Check DLQ for messages
     */
    async checkDLQForMessages() {
        console.log('🧪 Checking DLQ for Messages...\n');
        
        try {
            const command = `aws sqs get-queue-attributes --queue-url https://sqs.${this.region}.amazonaws.com/${this.accountId}/transcoding-dlq --attribute-names ApproximateNumberOfMessages`;
            const result = execSync(command, { encoding: 'utf8' });
            const attributes = JSON.parse(result);
            
            const messageCount = attributes.Attributes.ApproximateNumberOfMessages || '0';
            console.log(`📊 Messages in transcoding-dlq: ${messageCount}`);
            
            if (parseInt(messageCount) > 0) {
                console.log(`✅ DLQ is working! Found ${messageCount} failed messages`);
            } else {
                console.log(`ℹ️  No messages in DLQ yet (this is normal if no failures occurred)`);
            }
            console.log('');
            
            return parseInt(messageCount);
            
        } catch (error) {
            console.error(`❌ Error checking DLQ messages:`, error.message);
            return 0;
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Running DLQ Functionality Tests...\n');
        console.log('='.repeat(50));
        
        const results = {
            configuration: false,
            dlqQueues: false,
            cloudWatchAlarms: false,
            testMessage: false,
            dlqMessages: 0
        };
        
        // Test 1: DLQ Configuration
        results.configuration = await this.testDLQConfiguration();
        
        // Test 2: DLQ Queues Exist
        results.dlqQueues = await this.testDLQQueuesExist();
        
        // Test 3: CloudWatch Alarms
        results.cloudWatchAlarms = await this.testCloudWatchAlarms();
        
        // Test 4: Send Test Message
        results.testMessage = await this.sendTestMessage();
        
        // Test 5: Check DLQ Messages
        results.dlqMessages = await this.checkDLQForMessages();
        
        // Summary
        console.log('📋 TEST SUMMARY');
        console.log('='.repeat(50));
        console.log(`DLQ Configuration: ${results.configuration ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`DLQ Queues Exist: ${results.dlqQueues ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`CloudWatch Alarms: ${results.cloudWatchAlarms ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Test Message Sent: ${results.testMessage ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`DLQ Messages: ${results.dlqMessages} messages`);
        
        const overallPass = results.configuration && results.dlqQueues && results.cloudWatchAlarms;
        
        console.log(`\nOverall Status: ${overallPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        
        if (overallPass) {
            console.log('\n🎉 DLQ Implementation is working correctly!');
            console.log('✅ Assessment 3 DLQ criterion is satisfied');
        } else {
            console.log('\n⚠️  Some issues need to be resolved');
        }
        
        return results;
    }

    /**
     * Show help
     */
    showHelp() {
        console.log('\n📋 DLQ Functionality Tester');
        console.log('='.repeat(50));
        console.log('Usage: node scripts/test-dlq-functionality.js <command>');
        console.log('\nCommands:');
        console.log('  test        Run all DLQ functionality tests');
        console.log('  config      Test DLQ configuration only');
        console.log('  queues      Test DLQ queues exist only');
        console.log('  alarms      Test CloudWatch alarms only');
        console.log('  message     Send test message only');
        console.log('  check       Check DLQ for messages only');
        console.log('  help        Show this help message');
        console.log('\nExamples:');
        console.log('  node scripts/test-dlq-functionality.js test');
        console.log('  node scripts/test-dlq-functionality.js config');
    }
}

// Main execution
async function main() {
    const command = process.argv[2];
    const tester = new DLQTester();

    try {
        switch (command) {
            case 'test':
                await tester.runAllTests();
                break;
                
            case 'config':
                await tester.testDLQConfiguration();
                break;
                
            case 'queues':
                await tester.testDLQQueuesExist();
                break;
                
            case 'alarms':
                await tester.testCloudWatchAlarms();
                break;
                
            case 'message':
                await tester.sendTestMessage();
                break;
                
            case 'check':
                await tester.checkDLQForMessages();
                break;
                
            case 'help':
            default:
                tester.showHelp();
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

module.exports = DLQTester;
