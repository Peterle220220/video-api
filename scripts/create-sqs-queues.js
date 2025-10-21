require('dotenv').config();
const { SQSClient, CreateQueueCommand, GetQueueUrlCommand } = require('@aws-sdk/client-sqs');

class SQSQueueCreator {
    constructor() {
        this.sqs = new SQSClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
        this.accountId = '901444280953'; // Your AWS account ID
        this.region = process.env.AWS_REGION || 'ap-southeast-2';
    }

    async createQueue(queueName, attributes = {}) {
        try {
            console.log(`📝 Creating queue: ${queueName}...`);
            
            const defaultAttributes = {
                VisibilityTimeoutSeconds: '300',
                MessageRetentionPeriod: '1209600', // 14 days
                ReceiveMessageWaitTimeSeconds: '20',
                DelaySeconds: '0',
                ...attributes
            };

            const command = new CreateQueueCommand({
                QueueName: queueName,
                Attributes: defaultAttributes
            });

            const response = await this.sqs.send(command);
            const queueUrl = response.QueueUrl;
            
            console.log(`✅ Queue created: ${queueName}`);
            console.log(`   URL: ${queueUrl}`);
            console.log(`   ARN: arn:aws:sqs:${this.region}:${this.accountId}:${queueName}\n`);
            
            return queueUrl;
        } catch (error) {
            if (error.name === 'QueueAlreadyExists') {
                console.log(`⚠️ Queue ${queueName} already exists`);
                return `https://sqs.${this.region}.amazonaws.com/${this.accountId}/${queueName}`;
            }
            console.error(`❌ Error creating queue ${queueName}:`, error);
            throw error;
        }
    }

    async createAllQueues() {
        console.log('🚀 Creating SQS Queues for Video API\n');

        try {
            // Create transcoding queue
            await this.createQueue('transcoding-queue', {
                VisibilityTimeoutSeconds: '1800', // 30 minutes for transcoding
                MessageRetentionPeriod: '1209600', // 14 days
                ReceiveMessageWaitTimeSeconds: '20',
                DelaySeconds: '0'
            });

            // Create upload queue
            await this.createQueue('upload-queue', {
                VisibilityTimeoutSeconds: '300', // 5 minutes for upload processing
                MessageRetentionPeriod: '1209600', // 14 days
                ReceiveMessageWaitTimeSeconds: '20',
                DelaySeconds: '0'
            });

            // Create storage queue (AssemblyAI)
            await this.createQueue('storage-queue', {
                VisibilityTimeoutSeconds: '1800', // 30 minutes for AssemblyAI
                MessageRetentionPeriod: '1209600', // 14 days
                ReceiveMessageWaitTimeSeconds: '20',
                DelaySeconds: '0'
            });

            // Create notifications queue
            await this.createQueue('notifications-queue', {
                VisibilityTimeoutSeconds: '60', // 1 minute for notifications
                MessageRetentionPeriod: '1209600', // 14 days
                ReceiveMessageWaitTimeSeconds: '20',
                DelaySeconds: '0'
            });

            console.log('🎉 All SQS queues created successfully!');
            console.log('\n📋 Queue URLs:');
            console.log(`   Transcoding: https://sqs.${this.region}.amazonaws.com/${this.accountId}/transcoding-queue`);
            console.log(`   Upload: https://sqs.${this.region}.amazonaws.com/${this.accountId}/upload-queue`);
            console.log(`   Storage: https://sqs.${this.region}.amazonaws.com/${this.accountId}/storage-queue`);
            console.log(`   Notifications: https://sqs.${this.region}.amazonaws.com/${this.accountId}/notifications-queue`);

        } catch (error) {
            console.error('❌ Error creating queues:', error);
            process.exit(1);
        }
    }

    async listQueues() {
        try {
            console.log('📋 Listing existing queues...');
            
            const { ListQueuesCommand } = require('@aws-sdk/client-sqs');
            const command = new ListQueuesCommand({});
            const response = await this.sqs.send(command);
            
            if (response.QueueUrls && response.QueueUrls.length > 0) {
                console.log('📋 Existing queues:');
                response.QueueUrls.forEach(url => {
                    console.log(`   ${url}`);
                });
            } else {
                console.log('📭 No queues found');
            }
        } catch (error) {
            console.error('❌ Error listing queues:', error);
        }
    }
}

// CLI Interface
async function main() {
    const creator = new SQSQueueCreator();
    const command = process.argv[2];

    switch (command) {
        case 'create':
            await creator.createAllQueues();
            break;

        case 'list':
            await creator.listQueues();
            break;

        default:
            console.log('SQS Queue Creator');
            console.log('');
            console.log('Usage:');
            console.log('  node scripts/create-sqs-queues.js create  - Create all required queues');
            console.log('  node scripts/create-sqs-queues.js list    - List existing queues');
            break;
    }
}

// Run CLI if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Queue creator failed:', error);
        process.exit(1);
    });
}

module.exports = SQSQueueCreator;
